import * as path from 'path';
import { JavaClassMeta } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderEntity(meta: JavaClassMeta): string {
  const templatePath = path.join(__dirname, 'entity.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  // 1. Resolver imports
  const importsSet = new Set<string>([
    'java.util.UUID',
    'jakarta.persistence.*',
    'jakarta.validation.constraints.*',
  ]);
  if (meta.hasBigDecimals) importsSet.add('java.math.BigDecimal');
  if (meta.hasDates) {
    importsSet.add('java.time.LocalDate');
    importsSet.add('java.time.LocalDateTime');
  }
  if (meta.relationships.some((r) => r.type === 'ONE_TO_MANY' || r.type === 'MANY_TO_MANY')) {
    importsSet.add('java.util.List');
    importsSet.add('java.util.ArrayList');
    importsSet.add('com.fasterxml.jackson.annotation.JsonIgnore');
  }
  const sortedImports = Array.from(importsSet).sort();

  // 2. Procesar campos con flags booleanos
  const processedFields = meta.fields.map((field) => ({
    ...field,
    isId: field.isId,
    genStrategy: field.javaType === 'UUID' ? 'GenerationType.UUID' : 'GenerationType.IDENTITY',
    isNotBlank: !field.isId && !field.isNullable && field.javaType === 'String',
    isNotNull: !field.isId && !field.isNullable && field.javaType !== 'String',
  }));

  // 3. Procesar relaciones
  const processedRelationships = meta.relationships.map((rel) => {
    const isCollection = rel.type === 'ONE_TO_MANY' || rel.type === 'MANY_TO_MANY';
    return {
      ...rel,
      tableName: meta.tableName,
      isManyToOne: rel.type === 'MANY_TO_ONE',
      isOneToMany: rel.type === 'ONE_TO_MANY',
      isOneToOne: rel.type === 'ONE_TO_ONE',
      isManyToMany: rel.type === 'MANY_TO_MANY',
      capFieldName: rel.fieldName.charAt(0).toUpperCase() + rel.fieldName.slice(1),
      renderType: isCollection ? `List<${rel.targetClassName}>` : rel.targetClassName,
    };
  });

  // 4. Modelo de vista
  const viewContext = {
    basePackage: meta.basePackage,
    tableName: meta.tableName,
    className: meta.className,
    imports: sortedImports,
    processedFields,
    processedRelationships,
  };

  return renderMustache(mustacheTemplate, viewContext);
}
