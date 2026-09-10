import * as path from 'path';
import { JavaClassMeta, JavaField } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderCreateDto(meta: JavaClassMeta): string {
  const templatePath = path.join(__dirname, 'create-dto.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const imports = buildDtoImports(meta);
  const regularFields = meta.fields.filter((f) => !f.isId);
  const processedFields = regularFields.map((f) => ({
    ...f,
    isNotBlank: !f.isNullable && f.javaType === 'String',
    isNotNull: !f.isNullable && f.javaType !== 'String',
  }));
  const fkFields = buildDtoForeignKeyFields(meta);

  return renderMustache(mustacheTemplate, {
    basePackage: meta.basePackage,
    className: meta.className,
    imports,
    processedFields,
    fkFields,
  });
}

export function renderUpdateDto(meta: JavaClassMeta): string {
  const templatePath = path.join(__dirname, 'update-dto.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const imports = buildDtoImports(meta);
  const regularFields = meta.fields.filter((f) => !f.isId);
  const fkFields = buildDtoForeignKeyFields(meta);

  return renderMustache(mustacheTemplate, {
    basePackage: meta.basePackage,
    className: meta.className,
    imports,
    processedFields: regularFields,
    fkFields,
  });
}

export function renderResponseDto(meta: JavaClassMeta): string {
  const templatePath = path.join(__dirname, 'response-dto.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const imports = [
    'java.util.UUID',
    `${meta.basePackage}.entities.${meta.className}`,
  ];
  if (meta.hasBigDecimals) imports.push('java.math.BigDecimal');
  if (meta.hasDates) imports.push('java.time.LocalDate', 'java.time.LocalDateTime');

  const sortedImports = Array.from(new Set(imports)).sort();

  // Excluir campos de contraseña del DTO de respuesta por seguridad
  const responseFields = meta.fields.filter(
    (f) =>
      f.name.toLowerCase() !== 'password' &&
      f.name.toLowerCase() !== 'contrasena' &&
      f.name.toLowerCase() !== 'contraseña' &&
      f.name.toLowerCase() !== 'clave' &&
      f.name.toLowerCase() !== 'pass' &&
      f.name.toLowerCase() !== 'pwd',
  );

  return renderMustache(mustacheTemplate, {
    basePackage: meta.basePackage,
    className: meta.className,
    imports: sortedImports,
    processedFields: responseFields,
  });
}

function buildDtoImports(meta: JavaClassMeta): string[] {
  const imports: string[] = [
    'java.util.UUID',
    'jakarta.validation.constraints.*',
  ];

  if (meta.hasBigDecimals) {
    imports.push('java.math.BigDecimal');
  }
  if (meta.hasDates) {
    imports.push('java.time.LocalDate', 'java.time.LocalDateTime');
  }

  return Array.from(new Set(imports)).sort();
}

function buildDtoForeignKeyFields(meta: JavaClassMeta): { fieldName: string }[] {
  const result: { fieldName: string }[] = [];

  for (const rel of meta.relationships) {
    if (rel.type === 'MANY_TO_ONE' || rel.type === 'ONE_TO_ONE') {
      result.push({
        fieldName: rel.fieldName,
      });
    }
  }

  return result;
}
