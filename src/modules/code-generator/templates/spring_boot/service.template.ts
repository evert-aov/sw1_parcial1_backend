import * as path from 'path';
import { JavaClassMeta, hasPasswordField, getUserPasswordField } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderService(meta: JavaClassMeta, hasAuth = false): string {
  const templatePath = path.join(__dirname, 'service.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const idType = meta.idField.javaType;
  const isAuthProtected = hasAuth && hasPasswordField(meta);
  const passField = isAuthProtected ? getUserPasswordField(meta) : null;

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

  if (isAuthProtected) {
    imports.push('org.springframework.security.crypto.password.PasswordEncoder');
  }

  const uniqueImports = Array.from(new Set(imports)).sort();
  const regularFields = meta.fields.filter((f) => !f.isId);

  const createFieldAssignments = regularFields
    .map((f) => {
      if (passField && f.name.toLowerCase() === passField.name.toLowerCase()) {
        return `        entity.${f.setterName}(passwordEncoder.encode(dto.${f.getterName}()));`;
      }
      return `        entity.${f.setterName}(dto.${f.getterName}());`;
    })
    .join('\n');

  const updateFieldAssignments = regularFields
    .map((f) => {
      if (passField && f.name.toLowerCase() === passField.name.toLowerCase()) {
        return `        if (dto.${f.getterName}() != null && !dto.${f.getterName}().isBlank()) {\n            entity.${f.setterName}(passwordEncoder.encode(dto.${f.getterName}()));\n        }`;
      }
      return `        if (dto.${f.getterName}() != null) {\n            entity.${f.setterName}(dto.${f.getterName}());\n        }`;
    })
    .join('\n');

  return renderMustache(mustacheTemplate, {
    basePackage: meta.basePackage,
    className: meta.className,
    idType,
    isAuthProtected,
    imports: uniqueImports,
    createFieldAssignments,
    updateFieldAssignments,
  });
}
