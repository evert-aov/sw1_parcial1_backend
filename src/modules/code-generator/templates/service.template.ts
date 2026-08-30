import { JavaClassMeta } from './template-models';

export function renderServiceInterface(meta: JavaClassMeta): string {
  const idType = meta.idField.javaType;
  const imports: string[] = [
    'java.util.List',
    `${meta.basePackage}.dtos.Create${meta.className}Dto`,
    `${meta.basePackage}.dtos.Update${meta.className}Dto`,
    `${meta.basePackage}.dtos.${meta.className}ResponseDto`,
  ];

  if (idType === 'UUID') {
    imports.push('java.util.UUID');
  }

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  return `package ${meta.basePackage}.services;

${importStatements}

/**
 * Interfaz de servicio de negocio para la gestión de ${meta.className}.
 */
public interface ${meta.className}Service {

    List<${meta.className}ResponseDto> findAll();

    ${meta.className}ResponseDto findById(${idType} id);

    ${meta.className}ResponseDto create(Create${meta.className}Dto dto);

    ${meta.className}ResponseDto update(${idType} id, Update${meta.className}Dto dto);

    void delete(${idType} id);
}
`;
}

export function renderServiceImpl(meta: JavaClassMeta): string {
  const idType = meta.idField.javaType;
  const imports: string[] = [
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

  if (idType === 'UUID') {
    imports.push('java.util.UUID');
  }

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  const regularFields = meta.fields.filter((f) => !f.isId);

  const createFieldAssignments = regularFields
    .map((f) => `        entity.${f.setterName}(dto.${f.getterName}());`)
    .join('\n');

  const updateFieldAssignments = regularFields
    .map((f) => `        if (dto.${f.getterName}() != null) {\n            entity.${f.setterName}(dto.${f.getterName}());\n        }`)
    .join('\n');

  return `package ${meta.basePackage}.services.impl;

${importStatements}
import ${meta.basePackage}.services.${meta.className}Service;

/**
 * Implementación del servicio de negocio para ${meta.className}.
 */
@Service
@Transactional
public class ${meta.className}ServiceImpl implements ${meta.className}Service {

    private final ${meta.className}Repository repository;

    public ${meta.className}ServiceImpl(${meta.className}Repository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<${meta.className}ResponseDto> findAll() {
        return repository.findAll()
                .stream()
                .map(${meta.className}ResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ${meta.className}ResponseDto findById(${idType} id) {
        ${meta.className} entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("${meta.className} no encontrado con ID: " + id));
        return ${meta.className}ResponseDto.fromEntity(entity);
    }

    @Override
    public ${meta.className}ResponseDto create(Create${meta.className}Dto dto) {
        ${meta.className} entity = new ${meta.className}();
${createFieldAssignments}
        ${meta.className} saved = repository.save(entity);
        return ${meta.className}ResponseDto.fromEntity(saved);
    }

    @Override
    public ${meta.className}ResponseDto update(${idType} id, Update${meta.className}Dto dto) {
        ${meta.className} entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("${meta.className} no encontrado con ID: " + id));

${updateFieldAssignments}
        ${meta.className} updated = repository.save(entity);
        return ${meta.className}ResponseDto.fromEntity(updated);
    }

    @Override
    public void delete(${idType} id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("${meta.className} no encontrado con ID: " + id);
        }
        repository.deleteById(id);
    }
}
`;
}
