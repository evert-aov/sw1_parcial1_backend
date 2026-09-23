import * as path from 'path';
import { ProjectContext } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderFlywayMigration(context: ProjectContext): string {
  const templatePath = path.join(__dirname, 'flyway.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const tables: { tableName: string; columnsSql: string }[] = [];
  const foreignKeys: { sql: string }[] = [];

  // 1. Tablas
  for (const meta of context.classes) {
    // En estrategia SINGLE_TABLE, las clases hijas no crean tabla propia
    if (meta.isInheritanceChild) continue;

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

    // Si es clase padre de herencia (SINGLE_TABLE), agregar columna discriminadora y columnas de entidades hijas
    if (meta.isInheritanceParent) {
      const discCol = meta.discriminatorColumnName || `tipo_${meta.tableName}`;
      const discVal = meta.discriminatorValue || 'USUARIO_BASE';
      if (!addedColumns.has(discCol)) {
        columnDefs.push(`    "${discCol}" VARCHAR(20) NOT NULL DEFAULT '${discVal}'`);
        addedColumns.add(discCol);
      }

      const childClasses = context.classes.filter(
        (c) => c.isInheritanceChild && c.superClassName === meta.className,
      );
      for (const child of childClasses) {
        for (const field of child.fields) {
          if (field.isId) continue;
          if (addedColumns.has(field.sqlColumnName)) continue;
          // En SINGLE_TABLE las columnas de las hijas deben ser NULLABLE en la base de datos
          let col = `    "${field.sqlColumnName}" ${field.sqlType}`;
          if (field.isUnique) col += ' UNIQUE';
          columnDefs.push(col);
          addedColumns.add(field.sqlColumnName);
        }
        for (const rel of child.relationships) {
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
      }
    }

    tables.push({
      tableName: meta.tableName,
      columnsSql: columnDefs.join(',\n'),
    });
  }

  // 2. Claves foráneas
  for (const meta of context.classes) {
    for (const rel of meta.relationships) {
      if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
        const joinCol = rel.joinColumnName || `${rel.fieldName}_id`;
        const targetMeta = context.classes.find((c) => c.className === rel.targetClassName);
        const targetTable = targetMeta ? targetMeta.tableName : rel.targetClassName.toLowerCase();
        const targetIdCol = targetMeta ? targetMeta.idField.sqlColumnName : 'id';
        const fkPrefix = meta.isInheritanceChild
          ? `fk_${meta.tableName}_${meta.className.toLowerCase()}`
          : `fk_${meta.tableName}`;
        const fkName = `${fkPrefix}_${joinCol}`.slice(0, 63);

        foreignKeys.push({
          sql: `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fkName}') THEN
        ALTER TABLE "${meta.tableName}"
            ADD CONSTRAINT "${fkName}"
            FOREIGN KEY ("${joinCol}")
            REFERENCES "${targetTable}" ("${targetIdCol}")
            ON DELETE SET NULL;
    END IF;
END $$;`,
        });
      }
    }
  }

  return renderMustache(mustacheTemplate, {
    projectName: context.projectName,
    tables,
    hasForeignKeys: foreignKeys.length > 0,
    foreignKeys,
  });
}
