import { JavaClassMeta, JavaField } from './template-models';

/**
 * Renderiza el DTO de creación Create{Entity}Dto.
 */
export function renderCreateDto(meta: JavaClassMeta): string {
  const imports = buildDtoImports(meta, true);
  const regularFields = meta.fields.filter((f) => !f.isId);
  const fieldsCode = buildCreateDtoFields(regularFields);
  const fkFields = buildDtoForeignKeyFields(meta);
  const gettersAndSetters = buildDtoGettersAndSetters(meta, regularFields);

  return [
    `package ${meta.basePackage}.dtos;`,
    '',
    ...imports.map((imp) => `import ${imp};`),
    '',
    '/**',
    ` * DTO para la creación de ${meta.className}.`,
    ' */',
    `public class Create${meta.className}Dto {`,
    '',
    fieldsCode,
    '',
    ...(fkFields ? [fkFields, ''] : []),
    `    public Create${meta.className}Dto() {`,
    '    }',
    '',
    gettersAndSetters,
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza el DTO de actualización Update{Entity}Dto.
 */
export function renderUpdateDto(meta: JavaClassMeta): string {
  const imports = buildDtoImports(meta, false);
  const regularFields = meta.fields.filter((f) => !f.isId);
  const fieldsCode = regularFields
    .map((f) => `    private ${f.javaType} ${f.name};`)
    .join('\n');

  const fkFields = buildDtoForeignKeyFields(meta);
  const gettersAndSetters = buildDtoGettersAndSetters(meta, regularFields);

  return [
    `package ${meta.basePackage}.dtos;`,
    '',
    ...imports.map((imp) => `import ${imp};`),
    '',
    '/**',
    ` * DTO para la actualización de ${meta.className}.`,
    ' */',
    `public class Update${meta.className}Dto {`,
    '',
    fieldsCode,
    '',
    ...(fkFields ? [fkFields, ''] : []),
    `    public Update${meta.className}Dto() {`,
    '    }',
    '',
    gettersAndSetters,
    '}',
    '',
  ].join('\n');
}

/**
 * Renderiza el DTO de respuesta {Entity}ResponseDto con método de mapeo fromEntity.
 */
export function renderResponseDto(meta: JavaClassMeta): string {
  const imports = [
    'java.util.UUID',
    `${meta.basePackage}.entities.${meta.className}`,
  ];
  if (meta.hasBigDecimals) imports.push('java.math.BigDecimal');
  if (meta.hasDates) imports.push('java.time.LocalDate', 'java.time.LocalDateTime');

  const sortedImports = Array.from(new Set(imports)).sort();

  const fieldsCode = meta.fields
    .map((f) => `    private ${f.javaType} ${f.name};`)
    .join('\n');

  const mappingStatements = meta.fields
    .map((f) => `        dto.${f.setterName}(entity.${f.getterName}());`)
    .join('\n');

  const gettersAndSetters = buildDtoGettersAndSetters(meta, meta.fields, false);

  return [
    `package ${meta.basePackage}.dtos;`,
    '',
    ...sortedImports.map((imp) => `import ${imp};`),
    '',
    '/**',
    ` * DTO de respuesta para la entidad ${meta.className}.`,
    ' */',
    `public class ${meta.className}ResponseDto {`,
    '',
    fieldsCode,
    '',
    `    public ${meta.className}ResponseDto() {`,
    '    }',
    '',
    `    public static ${meta.className}ResponseDto fromEntity(${meta.className} entity) {`,
    '        if (entity == null) return null;',
    `        ${meta.className}ResponseDto dto = new ${meta.className}ResponseDto();`,
    mappingStatements,
    '        return dto;',
    '    }',
    '',
    gettersAndSetters,
    '}',
    '',
  ].join('\n');
}

function buildDtoImports(meta: JavaClassMeta, includeValidation: boolean): string[] {
  const imports: string[] = ['java.util.UUID'];
  if (includeValidation) {
    imports.push('jakarta.validation.constraints.*');
  }
  if (meta.hasBigDecimals) imports.push('java.math.BigDecimal');
  if (meta.hasDates) imports.push('java.time.LocalDate', 'java.time.LocalDateTime');

  return Array.from(new Set(imports)).sort();
}

function buildCreateDtoFields(fields: JavaField[]): string {
  return fields
    .map((f) => {
      const lines: string[] = [];
      if (!f.isNullable) {
        if (f.javaType === 'String') {
          lines.push(`    @NotBlank(message = "El campo '${f.name}' es obligatorio")`);
        } else {
          lines.push(`    @NotNull(message = "El campo '${f.name}' es obligatorio")`);
        }
      }
      lines.push(`    private ${f.javaType} ${f.name};`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function buildDtoForeignKeyFields(meta: JavaClassMeta): string {
  return meta.relationships
    .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
    .map((r) => `    private UUID ${r.fieldName}Id;`)
    .join('\n');
}

function buildDtoGettersAndSetters(
  meta: JavaClassMeta,
  fields: JavaField[],
  includeForeignKeys = true,
): string {
  const methods: string[] = [];

  for (const f of fields) {
    methods.push([
      `    public ${f.javaType} ${f.getterName}() {`,
      `        return ${f.name};`,
      '    }',
      '',
      `    public void ${f.setterName}(${f.javaType} ${f.name}) {`,
      `        this.${f.name} = ${f.name};`,
      '    }',
    ].join('\n'));
  }

  if (includeForeignKeys) {
    const fkRels = meta.relationships.filter(
      (r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE',
    );
    for (const r of fkRels) {
      const cap = r.fieldName.charAt(0).toUpperCase() + r.fieldName.slice(1);
      methods.push([
        `    public UUID get${cap}Id() {`,
        `        return ${r.fieldName}Id;`,
        '    }',
        '',
        `    public void set${cap}Id(UUID ${r.fieldName}Id) {`,
        `        this.${r.fieldName}Id = ${r.fieldName}Id;`,
        '    }',
      ].join('\n'));
    }
  }

  return methods.join('\n\n');
}
