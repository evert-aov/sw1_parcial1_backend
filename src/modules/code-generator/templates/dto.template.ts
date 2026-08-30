import { JavaClassMeta } from './template-models';

export function renderCreateDto(meta: JavaClassMeta): string {
  const imports: string[] = [
    'java.util.UUID',
    'jakarta.validation.constraints.*',
  ];

  if (meta.hasBigDecimals) imports.push('java.math.BigDecimal');
  if (meta.hasDates) imports.push('java.time.LocalDate', 'java.time.LocalDateTime');

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  // Campos sin ID
  const regularFields = meta.fields.filter((f) => !f.isId);

  const fieldsCode = regularFields
    .map((f) => {
      const annotations: string[] = [];
      if (!f.isNullable) {
        if (f.javaType === 'String') {
          annotations.push(`    @NotBlank(message = "El campo '${f.name}' es obligatorio")`);
        } else {
          annotations.push(`    @NotNull(message = "El campo '${f.name}' es obligatorio")`);
        }
      }
      return `${annotations.join('\n')}\n    private ${f.javaType} ${f.name};`;
    })
    .join('\n\n');

  // Foreign keys para relaciones @ManyToOne
  const fkFields = meta.relationships
    .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
    .map((r) => {
      return `    private UUID ${r.fieldName}Id;`;
    })
    .join('\n\n');

  const gettersAndSetters = [
    ...regularFields.map((f) => {
      return `    public ${f.javaType} ${f.getterName}() {\n        return ${f.name};\n    }\n\n    public void ${f.setterName}(${f.javaType} ${f.name}) {\n        this.${f.name} = ${f.name};\n    }`;
    }),
    ...meta.relationships
      .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
      .map((r) => {
        const cap = r.fieldName.charAt(0).toUpperCase() + r.fieldName.slice(1);
        return `    public UUID get${cap}Id() {\n        return ${r.fieldName}Id;\n    }\n\n    public void set${cap}Id(UUID ${r.fieldName}Id) {\n        this.${r.fieldName}Id = ${r.fieldName}Id;\n    }`;
      }),
  ].join('\n\n');

  return `package ${meta.basePackage}.dtos;

${importStatements}

/**
 * DTO para la creación de ${meta.className}.
 */
public class Create${meta.className}Dto {

${fieldsCode}

${fkFields ? fkFields + '\n\n' : ''}    public Create${meta.className}Dto() {
    }

${gettersAndSetters}
}
`;
}

export function renderUpdateDto(meta: JavaClassMeta): string {
  const imports: string[] = [
    'java.util.UUID',
  ];

  if (meta.hasBigDecimals) imports.push('java.math.BigDecimal');
  if (meta.hasDates) imports.push('java.time.LocalDate', 'java.time.LocalDateTime');

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  const regularFields = meta.fields.filter((f) => !f.isId);

  const fieldsCode = regularFields
    .map((f) => `    private ${f.javaType} ${f.name};`)
    .join('\n');

  const fkFields = meta.relationships
    .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
    .map((r) => `    private UUID ${r.fieldName}Id;`)
    .join('\n');

  const gettersAndSetters = [
    ...regularFields.map((f) => {
      return `    public ${f.javaType} ${f.getterName}() {\n        return ${f.name};\n    }\n\n    public void ${f.setterName}(${f.javaType} ${f.name}) {\n        this.${f.name} = ${f.name};\n    }`;
    }),
    ...meta.relationships
      .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
      .map((r) => {
        const cap = r.fieldName.charAt(0).toUpperCase() + r.fieldName.slice(1);
        return `    public UUID get${cap}Id() {\n        return ${r.fieldName}Id;\n    }\n\n    public void set${cap}Id(UUID ${r.fieldName}Id) {\n        this.${r.fieldName}Id = ${r.fieldName}Id;\n    }`;
      }),
  ].join('\n\n');

  return `package ${meta.basePackage}.dtos;

${importStatements}

/**
 * DTO para la actualización parcial o total de ${meta.className}.
 */
public class Update${meta.className}Dto {

${fieldsCode}

${fkFields ? fkFields + '\n\n' : ''}    public Update${meta.className}Dto() {
    }

${gettersAndSetters}
}
`;
}

export function renderResponseDto(meta: JavaClassMeta): string {
  const imports: string[] = [
    'java.util.UUID',
    `${meta.basePackage}.entities.${meta.className}`,
  ];

  if (meta.hasBigDecimals) imports.push('java.math.BigDecimal');
  if (meta.hasDates) imports.push('java.time.LocalDate', 'java.time.LocalDateTime');

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  const fieldsCode = meta.fields
    .map((f) => `    private ${f.javaType} ${f.name};`)
    .join('\n');

  const gettersAndSetters = meta.fields
    .map((f) => {
      return `    public ${f.javaType} ${f.getterName}() {\n        return ${f.name};\n    }\n\n    public void ${f.setterName}(${f.javaType} ${f.name}) {\n        this.${f.name} = ${f.name};\n    }`;
    })
    .join('\n\n');

  const mappingStatements = meta.fields
    .map((f) => `        dto.${f.setterName}(entity.${f.getterName}());`)
    .join('\n');

  return `package ${meta.basePackage}.dtos;

${importStatements}

/**
 * DTO de respuesta para la entidad ${meta.className}.
 */
public class ${meta.className}ResponseDto {

${fieldsCode}

    public ${meta.className}ResponseDto() {
    }

    public static ${meta.className}ResponseDto fromEntity(${meta.className} entity) {
        if (entity == null) return null;
        ${meta.className}ResponseDto dto = new ${meta.className}ResponseDto();
${mappingStatements}
        return dto;
    }

${gettersAndSetters}
}
`;
}
