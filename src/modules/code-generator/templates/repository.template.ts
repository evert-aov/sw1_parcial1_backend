import { JavaClassMeta } from './template-models';

export function renderRepository(meta: JavaClassMeta): string {
  const idType = meta.idField.javaType;
  const imports = [
    `${meta.basePackage}.entities.${meta.className}`,
    'org.springframework.data.jpa.repository.JpaRepository',
    'org.springframework.stereotype.Repository',
  ];

  if (idType === 'UUID') {
    imports.push('java.util.UUID');
  }

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  // Encontrar campos string o únicos para sugerir métodos de consulta
  const queryMethods = meta.fields
    .filter((f) => !f.isId && (f.isUnique || f.name.toLowerCase() === 'nombre' || f.name.toLowerCase() === 'codigo' || f.name.toLowerCase() === 'email'))
    .map((f) => {
      const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
      return `    java.util.Optional<${meta.className}> findBy${cap}(${f.javaType} ${f.name});`;
    });

  return `package ${meta.basePackage}.repositories;

${importStatements}

/**
 * Repositorio Spring Data JPA para la entidad ${meta.className}.
 */
@Repository
public interface ${meta.className}Repository extends JpaRepository<${meta.className}, ${idType}> {
${queryMethods.length > 0 ? '\n' + queryMethods.join('\n') + '\n' : ''}}
`;
}
