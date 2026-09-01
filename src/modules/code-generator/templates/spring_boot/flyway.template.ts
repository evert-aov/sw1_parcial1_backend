import { ProjectContext } from './template-models';

export function renderFlywayMigration(context: ProjectContext): string {
  const lines: string[] = [
    '--',
    '-- =========================================================================',
    '-- FLYWAY MIGRATION SCRIPT V1: INITIAL SCHEMA CREATION',
    `-- Project: ${context.projectName}`,
    `-- Generated: ${new Date().toISOString()}`,
    '-- =========================================================================',
    '',
    '-- Habilitar extensión para generación de UUIDs nativos',
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    '',
  ];

  // 1. Crear todas las tablas base
  for (const meta of context.classes) {
    lines.push(`-- Tabla: ${meta.tableName}`);
    lines.push(`CREATE TABLE IF NOT EXISTS "${meta.tableName}" (`);

    const columnDefs: string[] = [];
    const addedColumns = new Set<string>();

    // Clave primaria
    if (meta.idField.javaType === 'UUID') {
      columnDefs.push(`    "${meta.idField.sqlColumnName}" UUID PRIMARY KEY DEFAULT gen_random_uuid()`);
    } else {
      columnDefs.push(`    "${meta.idField.sqlColumnName}" BIGSERIAL PRIMARY KEY`);
    }
    addedColumns.add(meta.idField.sqlColumnName);

    // Campos normales
    for (const field of meta.fields) {
      if (field.isId) continue;
      if (addedColumns.has(field.sqlColumnName)) continue;

      let col = `    "${field.sqlColumnName}" ${field.sqlType}`;
      if (!field.isNullable) col += ' NOT NULL';
      if (field.isUnique) col += ' UNIQUE';
      columnDefs.push(col);
      addedColumns.add(field.sqlColumnName);
    }

    // Columnas de claves foráneas
    for (const rel of meta.relationships) {
      if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
        const joinCol = rel.joinColumnName || `${rel.fieldName}_id`;
        if (!addedColumns.has(joinCol)) {
          const targetMeta = context.classes.find((c) => c.className === rel.targetClassName);
          let targetSqlType = 'UUID';
          if (targetMeta) {
            targetSqlType = targetMeta.idField.javaType === 'UUID' ? 'UUID' : (targetMeta.idField.sqlType || 'BIGINT');
          }
          columnDefs.push(`    "${joinCol}" ${targetSqlType}`);
          addedColumns.add(joinCol);
        }
      }
    }

    // Timestamps de auditoría (solo si no fueron definidos como atributos de la clase)
    if (!addedColumns.has('created_at')) {
      columnDefs.push('    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL');
      addedColumns.add('created_at');
    }
    if (!addedColumns.has('updated_at')) {
      columnDefs.push('    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL');
      addedColumns.add('updated_at');
    }

    lines.push(columnDefs.join(',\n'));
    lines.push(');');
    lines.push('');
  }

  // 2. Crear tablas intermedias N:M si existen
  const processedManyToMany = new Set<string>();
  for (const meta of context.classes) {
    for (const rel of meta.relationships) {
      if (rel.type === 'MANY_TO_MANY') {
        const joinTableName = `${meta.tableName}_${rel.fieldName}`;
        if (!processedManyToMany.has(joinTableName)) {
          processedManyToMany.add(joinTableName);
          const targetMeta = context.classes.find((c) => c.className === rel.targetClassName);
          const targetTable = targetMeta ? targetMeta.tableName : rel.targetClassName.toLowerCase();

          const sourceIdType = meta.idField.javaType === 'UUID' ? 'UUID' : (meta.idField.sqlType || 'BIGINT');
          const targetIdType = targetMeta && targetMeta.idField.javaType === 'UUID' ? 'UUID' : (targetMeta ? targetMeta.idField.sqlType : 'BIGINT');
          const targetIdCol = targetMeta ? targetMeta.idField.sqlColumnName : 'id';

          lines.push(`-- Tabla Intermedia N:M: ${joinTableName}`);
          lines.push(`CREATE TABLE IF NOT EXISTS "${joinTableName}" (`);
          lines.push(`    "${meta.tableName}_id" ${sourceIdType} NOT NULL REFERENCES "${meta.tableName}"("${meta.idField.sqlColumnName}") ON DELETE CASCADE,`);
          lines.push(`    "${rel.fieldName}_id" ${targetIdType} NOT NULL REFERENCES "${targetTable}"("${targetIdCol}") ON DELETE CASCADE,`);
          lines.push(`    PRIMARY KEY ("${meta.tableName}_id", "${rel.fieldName}_id")`);
          lines.push(');');
          lines.push('');
        }
      }
    }
  }

  // 3. Crear Foreign Key Constraints con nombres explícitos
  lines.push('-- =========================================================================');
  lines.push('-- FOREIGN KEY CONSTRAINTS');
  lines.push('-- =========================================================================');
  lines.push('');

  for (const meta of context.classes) {
    for (const rel of meta.relationships) {
      if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
        const joinCol = rel.joinColumnName || `${rel.fieldName}_id`;
        const targetMeta = context.classes.find((c) => c.className === rel.targetClassName);
        const targetTable = targetMeta ? targetMeta.tableName : rel.targetClassName.toLowerCase();
        const targetIdCol = targetMeta ? targetMeta.idField.sqlColumnName : 'id';
        const fkName = `fk_${meta.tableName}_${joinCol}`;

        lines.push(`DO $$ BEGIN`);
        lines.push(`    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fkName}') THEN`);
        lines.push(`        ALTER TABLE "${meta.tableName}"`);
        lines.push(`            ADD CONSTRAINT "${fkName}" FOREIGN KEY ("${joinCol}")`);
        lines.push(`            REFERENCES "${targetTable}"("${targetIdCol}") ON DELETE SET NULL;`);
        lines.push(`    END IF;`);
        lines.push(`END $$;`);
        lines.push('');
      }
    }
  }

  // 4. Índices para optimización de consultas en FKs
  lines.push('-- =========================================================================');
  lines.push('-- INDEXES FOR FOREIGN KEYS & SEARCH');
  lines.push('-- =========================================================================');
  lines.push('');

  for (const meta of context.classes) {
    for (const rel of meta.relationships) {
      if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
        const joinCol = rel.joinColumnName || `${rel.fieldName}_id`;
        const idxName = `idx_${meta.tableName}_${joinCol}`;
        lines.push(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${meta.tableName}" ("${joinCol}");`);
      }
    }
  }

  // 5. Seed inicial para autenticación si existe clase de usuario
  if (context.hasAuth && context.userClass) {
    const u = context.userClass;
    const cols: string[] = [];
    const vals: string[] = [];

    for (const f of u.fields) {
      cols.push(`"${f.sqlColumnName}"`);
      if (f.isId) {
        vals.push('gen_random_uuid()');
      } else if (f.name.toLowerCase() === 'email' || f.name.toLowerCase() === 'correo') {
        vals.push("'admin@studio.com'");
      } else if (
        f.name.toLowerCase() === 'password' ||
        f.name.toLowerCase() === 'contrasena' ||
        f.name.toLowerCase() === 'contraseña' ||
        f.name.toLowerCase() === 'clave' ||
        f.name.toLowerCase() === 'pass'
      ) {
        vals.push("'$2a$10$P.ogHfHufpwpeGew6Mz.2uBmnnyScQ0sDdLXmtlr8gOhQThCb0fZK'");
      } else if (f.name.toLowerCase().includes('rol') || f.name.toLowerCase().includes('role')) {
        vals.push("'ADMIN'");
      } else if (f.name.toLowerCase() === 'username' || f.name.toLowerCase() === 'usuario') {
        vals.push("'admin'");
      } else if (f.name.toLowerCase().includes('nombre') || f.name.toLowerCase().includes('name')) {
        vals.push("'Administrador'");
      } else if (f.name.toLowerCase().includes('telefono') || f.name.toLowerCase().includes('phone')) {
        vals.push("'70000000'");
      } else if (f.name.toLowerCase().includes('nit') || f.name.toLowerCase().includes('ci') || f.name.toLowerCase().includes('documento')) {
        vals.push("'1234567'");
      } else if (f.javaType === 'String') {
        vals.push(`'${f.name}_admin'`);
      } else if (
        f.javaType === 'Integer' ||
        f.javaType === 'Long' ||
        f.javaType === 'Double' ||
        f.javaType === 'BigDecimal'
      ) {
        vals.push('0');
      } else if (f.javaType === 'Boolean') {
        vals.push('true');
      } else if (f.javaType === 'LocalDate') {
        vals.push('CURRENT_DATE');
      } else if (f.javaType === 'LocalDateTime') {
        vals.push('CURRENT_TIMESTAMP');
      } else if (f.javaType === 'UUID') {
        vals.push('gen_random_uuid()');
      } else {
        vals.push("'admin'");
      }
    }

    lines.push('');
    lines.push('-- =========================================================================');
    lines.push('-- INITIAL SEED DATA FOR AUTHENTICATION');
    lines.push('-- =========================================================================');
    lines.push(`-- Usuario inicial: admin@studio.com / Password: admin123 (BCrypt Hash)`);
    lines.push(`INSERT INTO "${u.tableName}" (${cols.join(', ')})`);
    lines.push(`VALUES (${vals.join(', ')})`);
    lines.push(`ON CONFLICT DO NOTHING;`);
  }

  return lines.join('\n');
}
