import { JavaClassMeta, JavaField, toCamelCase, toPascalCase, toSnakeCase } from '../spring_boot/template-models';

export interface DartField {
  name: string;
  dartType: string;
  jsonKey: string;
  isId: boolean;
  isNullable: boolean;
  isDateTime: boolean;
  isNumber: boolean;
  isBoolean: boolean;
  isString: boolean;
  defaultValue: string;
}

export function mapJavaTypeToDart(javaType: string): string {
  const norm = (javaType || 'String').trim().toLowerCase();
  switch (norm) {
    case 'uuid':
    case 'string':
    case 'text':
      return 'String';
    case 'int':
    case 'integer':
      return 'int';
    case 'long':
      return 'int';
    case 'double':
    case 'float':
    case 'bigdecimal':
      return 'double';
    case 'boolean':
    case 'bool':
      return 'bool';
    case 'localdate':
    case 'localdatetime':
    case 'date':
    case 'timestamp':
      return 'DateTime';
    default:
      return 'String';
  }
}

export function getDartFields(meta: JavaClassMeta): DartField[] {
  // 1. Recopilar todos los campos Java relevantes para la entidad/modelo Dart
  const allJavaFields: JavaField[] = [];

  // Asegurar que el ID esté presente al principio si la entidad tiene idField y no está en fields
  if (meta.idField && !meta.fields.some((f) => f.isId)) {
    allJavaFields.push(meta.idField);
  }

  // Si es subclase de herencia, incluir los campos heredados del padre
  if (meta.inheritedFields && meta.inheritedFields.length > 0) {
    for (const inf of meta.inheritedFields) {
      if (!allJavaFields.some((f) => f.name.toLowerCase() === inf.name.toLowerCase())) {
        allJavaFields.push(inf);
      }
    }
  }

  // Incluir campos propios de la clase
  for (const f of meta.fields) {
    if (!allJavaFields.some((af) => af.name.toLowerCase() === f.name.toLowerCase())) {
      allJavaFields.push(f);
    }
  }

  // Filtrar columna discriminadora si existe (para no exponerla como campo de formulario modificable)
  const discCol = (meta.discriminatorColumnName || '').toLowerCase();
  const discField = (meta.discriminatorFieldName || '').toLowerCase();

  // Excluir campos escalares que duplican una clave foránea para usar el nombre canónico de la relación
  const nonDuplicateFields = allJavaFields.filter((f) => {
    if (discCol && f.sqlColumnName.toLowerCase() === discCol) return false;
    if (discField && f.name.toLowerCase() === discField) return false;
    return (
      !f.isForeignKey &&
      !meta.relationships.some(
        (r) =>
          (r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE') &&
          r.joinColumnName?.toLowerCase() === f.sqlColumnName.toLowerCase(),
      )
    );
  });

  const fields: DartField[] = nonDuplicateFields.map((f) => {
    const dartType = mapJavaTypeToDart(f.javaType);
    const isDateTime = dartType === 'DateTime';
    const isNumber = dartType === 'int' || dartType === 'double';
    const isBoolean = dartType === 'bool';
    const isString = dartType === 'String';

    let defaultValue = "''";
    if (dartType === 'int') defaultValue = '0';
    if (dartType === 'double') defaultValue = '0.0';
    if (dartType === 'bool') defaultValue = 'false';
    if (dartType === 'DateTime') defaultValue = 'DateTime.now()';

    return {
      name: f.name,
      dartType,
      jsonKey: f.name,
      isId: f.isId,
      isNullable: f.isNullable,
      isDateTime,
      isNumber,
      isBoolean,
      isString,
      defaultValue,
    };
  });

  // Agregar Foreign Keys generadas a partir de relaciones MANY_TO_ONE y ONE_TO_ONE
  for (const rel of meta.relationships || []) {
    if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
      const fkCamel = toCamelCase(rel.fieldName) + 'Id';
      if (!fields.some((f) => f.name.toLowerCase() === fkCamel.toLowerCase())) {
        fields.push({
          name: fkCamel,
          dartType: 'String',
          jsonKey: fkCamel,
          isId: false,
          isNullable: true,
          isDateTime: false,
          isNumber: false,
          isBoolean: false,
          isString: true,
          defaultValue: "''",
        });
      }
    }
  }

  return fields;
}

export function getPluralName(name: string): string {
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z')) {
    return name + 'es';
  }
  return name + 's';
}
