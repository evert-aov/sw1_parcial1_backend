import * as path from 'path';
import { JavaClassMeta } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderService(meta: JavaClassMeta): string {
  const templatePath = path.join(__dirname, 'service.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const idType = meta.idField.javaType;

  const imports = [
    'java.util.UUID',
    'java.util.List',
    'java.util.stream.Collectors',
    'org.springframework.stereotype.Service',
    'org.springframework.transaction.annotation.Transactional',
    `${meta.basePackage}.entities.${meta.className}`,
    `${meta.basePackage}.repositories.${meta.className}Repository`,
    `${meta.basePackage}.dtos.Create${meta.className}Dto`,
    `${meta.basePackage}.dtos.Update${meta.className}Dto`,
    `${meta.basePackage}.dtos.${meta.className}ResponseDto`,
    `${meta.basePackage}.exceptions.ResourceNotFoundException`,
  ];

  for (const rel of meta.relationships) {
    if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
      imports.push(`${meta.basePackage}.entities.${rel.targetClassName}`);
    }
  }

  const uniqueImports = Array.from(new Set(imports)).sort();

  const isFkField = (f: any) =>
    f.isForeignKey ||
    meta.relationships.some(
      (r) =>
        (r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE') &&
        r.joinColumnName?.toLowerCase() === f.sqlColumnName.toLowerCase(),
    );

  const allFields = meta.isInheritanceChild && meta.inheritedFields
    ? [...meta.inheritedFields, ...meta.fields.filter((f) => !f.isId)]
    : meta.fields.filter((f) => !f.isId);

  const regularFields = allFields.filter((f) => !isFkField(f));

  const regularCreateAssignments = regularFields.map((f) => {
    return `        entity.${f.setterName}(dto.${f.getterName}());`;
  });

  const relCreateAssignments = meta.relationships
    .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
    .map((r) => {
      const capName = r.fieldName.charAt(0).toUpperCase() + r.fieldName.slice(1);
      const setter = r.targetIdSetterName || 'setId';
      return `        if (dto.get${capName}Id() != null) {\n            ${r.targetClassName} ${r.fieldName} = new ${r.targetClassName}();\n            ${r.fieldName}.${setter}(dto.get${capName}Id());\n            entity.set${capName}(${r.fieldName});\n        }`;
    });

  const createFieldAssignments = [...regularCreateAssignments, ...relCreateAssignments].join('\n');

  const regularUpdateAssignments = regularFields.map((f) => {
    return `        if (dto.${f.getterName}() != null) {\n            entity.${f.setterName}(dto.${f.getterName}());\n        }`;
  });

  const relUpdateAssignments = meta.relationships
    .filter((r) => r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
    .map((r) => {
      const capName = r.fieldName.charAt(0).toUpperCase() + r.fieldName.slice(1);
      const setter = r.targetIdSetterName || 'setId';
      return `        if (dto.get${capName}Id() != null) {\n            ${r.targetClassName} ${r.fieldName} = new ${r.targetClassName}();\n            ${r.fieldName}.${setter}(dto.get${capName}Id());\n            entity.set${capName}(${r.fieldName});\n        }`;
    });

  const updateFieldAssignments = [...regularUpdateAssignments, ...relUpdateAssignments].join('\n');

  return renderMustache(mustacheTemplate, {
    basePackage: meta.basePackage,
    className: meta.className,
    idType,
    imports: uniqueImports,
    createFieldAssignments,
    updateFieldAssignments,
  });
}
