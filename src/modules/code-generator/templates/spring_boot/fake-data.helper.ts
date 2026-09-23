import { JavaClassMeta, JavaField, JavaRelationship } from './template-models';

export interface SeededRow {
  id: string | number;
  sqlValues: Record<string, string>; // column_name -> SQL literal (e.g. "'Texto'", "12.5", "TRUE")
  dtoValues: Record<string, any>; // propertyName -> JS value for JSON
}

export interface SeededEntityData {
  meta: JavaClassMeta;
  classIndex: number;
  rows: SeededRow[];
  samplePostDto: Record<string, any>;
  samplePutDto: Record<string, any>;
}

/**
 * Ordena las entidades topológicamente para que las tablas padre (sin claves foráneas)
 * se creen y pueblen antes que las tablas hijas (con claves foráneas).
 */
export function sortClassesTopologically(classes: JavaClassMeta[]): JavaClassMeta[] {
  const classMap = new Map<string, JavaClassMeta>();
  classes.forEach((c) => classMap.set(c.className, c));

  const dependencies = new Map<string, Set<string>>();
  for (const c of classes) {
    const deps = new Set<string>();
    for (const r of c.relationships) {
      if (
        (r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE') &&
        classMap.has(r.targetClassName) &&
        r.targetClassName !== c.className
      ) {
        deps.add(r.targetClassName);
      }
    }
    if (c.isInheritanceChild && c.superClassName && classMap.has(c.superClassName)) {
      deps.add(c.superClassName);
    }
    dependencies.set(c.className, deps);
  }

  const result: JavaClassMeta[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(className: string) {
    if (visited.has(className)) return;
    if (visiting.has(className)) {
      // Ciclo detectado, rompemos recursión
      return;
    }
    visiting.add(className);
    const deps = dependencies.get(className) || new Set();
    for (const dep of deps) {
      visit(dep);
    }
    visiting.delete(className);
    visited.add(className);
    const meta = classMap.get(className);
    if (meta) result.push(meta);
  }

  for (const c of classes) {
    if (!visited.has(c.className)) {
      visit(c.className);
    }
  }

  return result;
}

/**
 * Genera un ID determinista para una clase y fila específica.
 */
export function generateEntityId(isUuid: boolean, classIndex: number, rowIndex: number): string | number {
  if (isUuid) {
    const classHex = String(classIndex).padStart(4, '0');
    const rowHex = String(rowIndex).padStart(12, '0');
    return `00000000-0000-0000-${classHex}-${rowHex}`;
  }
  return rowIndex;
}

/**
 * Genera valores falsos contextuales según el nombre de la clase, campo y tipo de dato.
 */
export function generateFieldValue(
  className: string,
  field: JavaField,
  rowIndex: number,
  isPost = false,
  isPut = false,
): { sql: string; js: any } {
  const nameLower = field.name.toLowerCase();
  const typeLower = (field.javaType || '').toLowerCase();
  const classLower = className.toLowerCase();

  // 1. Tipos booleanos
  if (typeLower === 'boolean') {
    const val = rowIndex % 2 === 1;
    return { sql: val ? 'TRUE' : 'FALSE', js: val };
  }

  // 2. Tipos numéricos enteros
  if (typeLower === 'int' || typeLower === 'integer' || typeLower === 'long' || typeLower === 'short') {
    let num = 10 * rowIndex;
    if (nameLower.includes('edad') || nameLower.includes('age')) num = 18 + rowIndex * 2;
    else if (nameLower.includes('credito')) num = 3 + rowIndex;
    else if (nameLower.includes('semestre') || nameLower.includes('nivel')) num = rowIndex;
    else if (nameLower.includes('stock') || nameLower.includes('cant')) num = 25 * rowIndex;
    else if (nameLower.includes('hora')) num = 40 + rowIndex * 10;
    if (isPost) num = 99;
    if (isPut) num += 5;
    return { sql: String(num), js: num };
  }

  // 3. Tipos decimales / monetarios
  if (typeLower === 'double' || typeLower === 'float' || typeLower === 'bigdecimal') {
    let dec = 50.0 + rowIndex * 25.5;
    if (nameLower.includes('precio') || nameLower.includes('cost') || nameLower.includes('monto') || nameLower.includes('total')) {
      dec = 120.0 + rowIndex * 35.5;
    } else if (nameLower.includes('nota') || nameLower.includes('promedio') || nameLower.includes('score')) {
      dec = 75.0 + rowIndex * 6.5;
    }
    if (isPost) dec = 299.99;
    if (isPut) dec = 350.5;
    const rounded = Math.round(dec * 100) / 100;
    return { sql: rounded.toFixed(2), js: rounded };
  }

  // 4. Fechas
  if (typeLower === 'localdate' || typeLower === 'date') {
    const dates = ['2024-01-15', '2024-03-20', '2024-06-10', '2024-09-01'];
    const d = dates[(rowIndex - 1) % dates.length];
    return { sql: `'${d}'`, js: d };
  }

  if (typeLower === 'localdatetime' || typeLower === 'timestamp') {
    const dateTimes = [
      '2024-01-15T08:30:00',
      '2024-03-20T14:00:00',
      '2024-06-10T18:45:00',
      '2024-09-01T10:15:00',
    ];
    const dt = dateTimes[(rowIndex - 1) % dateTimes.length];
    return { sql: `'${dt}'`, js: dt };
  }

  if (typeLower === 'uuid') {
    const u = `f0000000-0000-0000-${String(rowIndex).padStart(4, '0')}-000000000001`;
    return { sql: `'${u}'`, js: u };
  }

  // 5. Cadenas de texto con heurística contextual
  let strVal = '';

  if (nameLower.includes('email') || nameLower.includes('correo')) {
    strVal = `contacto.${classLower}${rowIndex}@ejemplo.com`;
  } else if (nameLower.includes('phone') || nameLower.includes('telefono') || nameLower.includes('celular') || nameLower.includes('movil')) {
    strVal = `+591 7${String(rowIndex).padStart(2, '0')}12345`;
  } else if (nameLower.includes('ci') || nameLower.includes('dni') || nameLower.includes('nit') || nameLower.includes('documento') || nameLower.includes('cedula')) {
    strVal = `84${String(rowIndex).padStart(2, '0')}123`;
  } else if (nameLower.includes('sigla')) {
    strVal = `${className.slice(0, 4).toUpperCase()}${rowIndex}`;
  } else if (nameLower.includes('codigo') || nameLower.includes('code')) {
    strVal = `COD-${className.slice(0, 3).toUpperCase()}-${String(rowIndex).padStart(3, '0')}`;
  } else if (nameLower.includes('direccion') || nameLower.includes('address') || nameLower.includes('ubicacion')) {
    const dirs = ['Av. Busch #450', 'Calle 21 de Calacoto #100', 'Av. América #320', 'Av. Las Américas #880'];
    strVal = dirs[(rowIndex - 1) % dirs.length];
  } else if (nameLower.includes('ciudad') || nameLower.includes('city')) {
    const cities = ['Santa Cruz de la Sierra', 'La Paz', 'Cochabamba', 'Sucre'];
    strVal = cities[(rowIndex - 1) % cities.length];
  } else if (nameLower.includes('pais') || nameLower.includes('country')) {
    strVal = 'Bolivia';
  } else if (nameLower.includes('estado') || nameLower.includes('status')) {
    const states = ['ACTIVO', 'ACTIVO', 'PENDIENTE', 'ACTIVO'];
    strVal = states[(rowIndex - 1) % states.length];
  } else if (nameLower.includes('descripcion') || nameLower.includes('description') || nameLower.includes('detalle')) {
    strVal = `Registro de prueba #${rowIndex} para la entidad ${className} con datos iniciales verificados.`;
  } else if (nameLower.includes('nombre') || nameLower.includes('name') || nameLower.includes('titulo') || nameLower.includes('title')) {
    // Contexto específico según el nombre de la clase
    if (classLower.includes('universidad')) {
      const unis = [
        'Universidad Autónoma Gabriel René Moreno',
        'Universidad Privada de Santa Cruz de la Sierra',
        'Universidad Católica Boliviana San Pablo',
        'Universidad Mayor de San Andrés',
      ];
      strVal = unis[(rowIndex - 1) % unis.length];
    } else if (classLower.includes('facultad')) {
      const facs = [
        'Facultad de Ciencias de la Computación y Telecomunicaciones',
        'Facultad de Ciencias Exactas y Tecnología',
        'Facultad de Ciencias Económicas y Empresariales',
        'Facultad de Humanidades',
      ];
      strVal = facs[(rowIndex - 1) % facs.length];
    } else if (classLower.includes('carrera')) {
      const careers = [
        'Ingeniería en Sistemas',
        'Ingeniería Informática',
        'Ingeniería en Redes y Telecomunicaciones',
        'Administración de Empresas',
      ];
      strVal = careers[(rowIndex - 1) % careers.length];
    } else if (classLower.includes('materia') || classLower.includes('asignatura') || classLower.includes('curso')) {
      const mats = [
        'Sistemas de Información I',
        'Base de Datos II',
        'Arquitectura de Software',
        'Redes Avanzadas',
      ];
      strVal = mats[(rowIndex - 1) % mats.length];
    } else if (classLower.includes('docente') || classLower.includes('profesor')) {
      const profs = ['Ing. Alberto Soto', 'Lic. Patricia Rojas', 'Dr. Carlos Méndez', 'MSc. Elena Morales'];
      strVal = profs[(rowIndex - 1) % profs.length];
    } else if (classLower.includes('estudiante') || classLower.includes('alumno')) {
      const studs = ['Carlos Andrés Pérez', 'María José Gómez', 'Juan Rodrigo Banegas', 'Luciana Fernández'];
      strVal = studs[(rowIndex - 1) % studs.length];
    } else if (classLower.includes('persona') || classLower.includes('usuario') || classLower.includes('cliente') || classLower.includes('empleado')) {
      const persons = ['Juan Carlos Pérez', 'María Elena Flores', 'Rodrigo Banegas', 'Andrea Suárez'];
      strVal = persons[(rowIndex - 1) % persons.length];
    } else if (classLower.includes('producto') || classLower.includes('articulo') || classLower.includes('item')) {
      const prods = ['Laptop Lenovo ThinkPad', 'Monitor Dell 27 4K', 'Teclado Mecánico RGB', 'Mouse Inalámbrico'];
      strVal = prods[(rowIndex - 1) % prods.length];
    } else if (classLower.includes('categoria')) {
      const cats = ['Tecnología', 'Electrónica', 'Accesorios', 'Servicios'];
      strVal = cats[(rowIndex - 1) % cats.length];
    } else {
      strVal = `${className} Ejemplar #${rowIndex}`;
    }
  } else {
    strVal = `${field.name}_valor_${rowIndex}`;
  }

  if (isPost) {
    strVal = `${strVal} (Nuevo Creado)`;
  } else if (isPut) {
    strVal = `${strVal} (Actualizado)`;
  }

  const escapedSql = strVal.replace(/'/g, "''");
  return { sql: `'${escapedSql}'`, js: strVal };
}

/**
 * Genera el conjunto completo de datos de prueba (Seed Data) para todas las clases del proyecto.
 */
export function generateProjectSeedData(classes: JavaClassMeta[]): SeededEntityData[] {
  const sortedClasses = sortClassesTopologically(classes);
  const classIndexMap = new Map<string, number>();
  sortedClasses.forEach((c, idx) => classIndexMap.set(c.className, idx + 1));

  const result: SeededEntityData[] = [];
  const entityRowsMap = new Map<string, SeededRow[]>();

  for (let i = 0; i < sortedClasses.length; i++) {
    const meta = sortedClasses[i];
    const classIndex = i + 1;
    const isUuid = meta.idField.javaType === 'UUID';

    const rows: SeededRow[] = [];
    const NUM_ROWS = 3;

    // Campos normales que se insertan en la tabla (excluye ID y claves foráneas que se manejan aparte)
    const baseFields = meta.isInheritanceChild && meta.inheritedFields
      ? [...meta.inheritedFields, ...meta.fields]
      : meta.fields;

    const normalFields = baseFields.filter(
      (f) =>
        !f.isId &&
        !f.isForeignKey &&
        !meta.relationships.some(
          (r) =>
            (r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE') &&
            r.joinColumnName?.toLowerCase() === f.sqlColumnName.toLowerCase(),
        ),
    );

    // Relaciones foráneas directas (MANY_TO_ONE o ONE_TO_ONE)
    const directRels = meta.relationships.filter(
      (r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE',
    );

    for (let r = 1; r <= NUM_ROWS; r++) {
      const rowId = generateEntityId(isUuid, classIndex, r);
      const sqlValues: Record<string, string> = {};
      const dtoValues: Record<string, any> = {};

      // 1. Clave primaria
      sqlValues[meta.idField.sqlColumnName] = isUuid ? `'${rowId}'` : String(rowId);
      dtoValues[meta.idField.name] = rowId;

      // Columna discriminadora para SINGLE_TABLE
      if (meta.isInheritanceParent || meta.isInheritanceChild) {
        const discCol = meta.discriminatorColumnName || `tipo_${meta.tableName}`;
        const discVal = meta.discriminatorValue || (meta.isInheritanceChild ? meta.className.toUpperCase() : 'BASE');
        sqlValues[discCol] = `'${discVal}'`;
        dtoValues[meta.discriminatorFieldName || 'tipoUsuario'] = discVal;
      }

      // 2. Campos regulares
      for (const field of normalFields) {
        const val = generateFieldValue(meta.className, field, r);
        sqlValues[field.sqlColumnName] = val.sql;
        dtoValues[field.name] = val.js;
      }

      // 3. Claves foráneas hacia entidades padre
      for (const rel of directRels) {
        const joinCol = rel.joinColumnName || `${rel.fieldName}_id`;
        const targetRows = entityRowsMap.get(rel.targetClassName);
        if (targetRows && targetRows.length > 0) {
          // Asigna la fila 1 de la entidad padre a las filas 1 y 2, y la fila 2 a la fila 3
          const targetIndex = r === 3 && targetRows.length > 1 ? 1 : 0;
          const parentRow = targetRows[targetIndex];
          const parentTargetMeta = sortedClasses.find((c) => c.className === rel.targetClassName);
          const parentIsUuid = parentTargetMeta ? parentTargetMeta.idField.javaType === 'UUID' : isUuid;

          sqlValues[joinCol] = parentIsUuid ? `'${parentRow.id}'` : String(parentRow.id);
          dtoValues[`${rel.fieldName}Id`] = parentRow.id;
        }
      }

      rows.push({
        id: rowId,
        sqlValues,
        dtoValues,
      });
    }

    entityRowsMap.set(meta.className, rows);

    // Muestra para POST (Crear nuevo) - fila 4
    const samplePostDto: Record<string, any> = {};
    for (const field of normalFields) {
      const val = generateFieldValue(meta.className, field, 4, true, false);
      samplePostDto[field.name] = val.js;
    }
    for (const rel of directRels) {
      const targetRows = entityRowsMap.get(rel.targetClassName);
      if (targetRows && targetRows.length > 0) {
        samplePostDto[`${rel.fieldName}Id`] = targetRows[0].id;
      }
    }

    // Muestra para PUT (Actualizar existente) - actualiza fila 1
    const samplePutDto: Record<string, any> = {};
    for (const field of normalFields) {
      const val = generateFieldValue(meta.className, field, 1, false, true);
      samplePutDto[field.name] = val.js;
    }
    for (const rel of directRels) {
      const targetRows = entityRowsMap.get(rel.targetClassName);
      if (targetRows && targetRows.length > 0) {
        samplePutDto[`${rel.fieldName}Id`] = targetRows[0].id;
      }
    }

    result.push({
      meta,
      classIndex,
      rows,
      samplePostDto,
      samplePutDto,
    });
  }

  return result;
}
