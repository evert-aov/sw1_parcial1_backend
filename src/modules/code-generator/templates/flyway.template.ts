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

    // Clave primaria
    if (meta.idField.javaType === 'UUID') {
      columnDefs.push(`    "${meta.idField.sqlColumnName}" UUID PRIMARY KEY DEFAULT gen_random_uuid()`);
    } else {
      columnDefs.push(`    "${meta.idField.sqlColumnName}" BIGSERIAL PRIMARY KEY`);
    }

    // Campos normales
    for (const field of meta.fields) {
      if (field.isId) continue;
      let col = `    "${field.sqlColumnName}" ${field.sqlType}`;
      if (!field.isNullable) col += ' NOT NULL';
      if (field.isUnique) col += ' UNIQUE';
      columnDefs.push(col);
    }

    // Columnas de claves foráneas
    for (const rel of meta.relationships) {
      if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
        const joinCol = rel.joinColumnName || `${rel.fieldName}_id`;
        columnDefs.push(`    "${joinCol}" UUID`);
      }
    }

    // Timestamps de auditoría
    columnDefs.push('    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL');
    columnDefs.push('    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL');

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

          lines.push(`-- Tabla Intermedia N:M: ${joinTableName}`);
          lines.push(`CREATE TABLE IF NOT EXISTS "${joinTableName}" (`);
          lines.push(`    "${meta.tableName}_id" UUID NOT NULL REFERENCES "${meta.tableName}"("${meta.idField.sqlColumnName}") ON DELETE CASCADE,`);
          lines.push(`    "${rel.fieldName}_id" UUID NOT NULL REFERENCES "${targetTable}"("id") ON DELETE CASCADE,`);
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

  return lines.join('\n');
}
