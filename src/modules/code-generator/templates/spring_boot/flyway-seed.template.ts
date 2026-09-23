import { ProjectContext } from './template-models';
import { SeededEntityData } from './fake-data.helper';

export function renderFlywaySeedData(context: ProjectContext, seededData: SeededEntityData[]): string {
  const lines: string[] = [];

  lines.push('-- =========================================================================');
  lines.push('-- FLYWAY MIGRATION SCRIPT V2: SEED DATA FOR INSTANT TESTING');
  lines.push(`-- Project: ${context.projectName}`);
  lines.push('-- =========================================================================');
  lines.push('');

  const sequenceFixes: string[] = [];

  for (const item of seededData) {
    const { meta, rows } = item;
    if (rows.length === 0) continue;

    const firstRow = rows[0];
    const columns = Object.keys(firstRow.sqlValues);
    const quotedColumns = columns.map((c) => `"${c}"`).join(', ');

    lines.push(`-- Datos iniciales de prueba para: ${meta.className} (${meta.tableName})`);
    lines.push(`INSERT INTO "${meta.tableName}" (${quotedColumns})`);
    lines.push('VALUES');

    const valueRows: string[] = [];
    for (const r of rows) {
      const rowVals = columns.map((col) => r.sqlValues[col] ?? 'NULL').join(', ');
      valueRows.push(`  (${rowVals})`);
    }

    lines.push(valueRows.join(',\n'));
    lines.push('ON CONFLICT DO NOTHING;');
    lines.push('');

    // Si el ID no es UUID, se debe sincronizar la secuencia de PostgreSQL
    if (meta.idField.javaType !== 'UUID') {
      const idCol = meta.idField.sqlColumnName;
      sequenceFixes.push(
        `SELECT setval(pg_get_serial_sequence('${meta.tableName}', '${idCol}'), coalesce((SELECT max("${idCol}") FROM "${meta.tableName}"), 1));`,
      );
    }
  }

  if (sequenceFixes.length > 0) {
    lines.push('-- =========================================================================');
    lines.push('-- Sincronización de secuencias para inserciones futuras');
    lines.push('-- =========================================================================');
    for (const fix of sequenceFixes) {
      lines.push(fix);
    }
    lines.push('');
  }

  return lines.join('\n');
}
