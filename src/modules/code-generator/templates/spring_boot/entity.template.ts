import { JavaClassMeta, JavaField, JavaRelationship } from './template-models';

/**
 * Renderiza la clase Entity JPA en formato Java estándar.
 * Utiliza estructuras modulares y arrays limpios para máxima legibilidad.
 */
export function renderEntity(meta: JavaClassMeta): string {
  const imports = buildEntityImports(meta);
  const fields = buildEntityFields(meta.fields);
  const relationships = buildEntityRelationships(meta);
  const gettersAndSetters = buildEntityGettersAndSetters(meta);

  return [
    `package ${meta.basePackage}.entities;`,
    '',
    ...imports.map((imp) => `import ${imp};`),
    '',
    '/**',
    ` * Entidad JPA para la tabla '${meta.tableName}'.`,
    ' * Generada automáticamente por UML Studio Architecture Generator.',
    ' */',
    '@Entity',
    `@Table(name = "${meta.tableName}")`,
    `public class ${meta.className} {`,
    '',
    fields,
    '',
    ...(relationships ? [relationships, ''] : []),
    `    public ${meta.className}() {`,
    '    }',
    '',
    gettersAndSetters,
    '}',
    '',
  ].join('\n');
}

function buildEntityImports(meta: JavaClassMeta): string[] {
  const imports: string[] = [
    'java.util.UUID',
    'jakarta.persistence.*',
    'jakarta.validation.constraints.*',
  ];

  if (meta.hasBigDecimals) {
    imports.push('java.math.BigDecimal');
  }
  if (meta.hasDates) {
    imports.push('java.time.LocalDate', 'java.time.LocalDateTime');
  }
  if (meta.relationships.some((r) => r.type === 'ONE_TO_MANY' || r.type === 'MANY_TO_MANY')) {
    imports.push('java.util.List', 'java.util.ArrayList');
    imports.push('com.fasterxml.jackson.annotation.JsonIgnore');
  }

  return Array.from(new Set(imports)).sort();
}

function buildEntityFields(fields: JavaField[]): string {
  return fields
    .map((field) => {
      if (field.isId) {
        const genStrategy = field.javaType === 'UUID'
          ? 'GenerationType.UUID'
          : 'GenerationType.IDENTITY';

        return [
          '    @Id',
          `    @GeneratedValue(strategy = ${genStrategy})`,
          `    @Column(name = "${field.sqlColumnName}", updatable = false, nullable = false)`,
          `    private ${field.javaType} ${field.name};`,
        ].join('\n');
      }

      const lines: string[] = [];

      // Validaciones Jakarta Bean Validation
      if (!field.isNullable) {
        if (field.javaType === 'String') {
          lines.push(`    @NotBlank(message = "El campo '${field.name}' es obligatorio")`);
        } else {
          lines.push(`    @NotNull(message = "El campo '${field.name}' no puede ser nulo")`);
        }
      }

      // Anotación JPA @Column
      if (field.isUnique) {
        lines.push(`    @Column(name = "${field.sqlColumnName}", unique = true)`);
      } else {
        lines.push(`    @Column(name = "${field.sqlColumnName}")`);
      }

      lines.push(`    private ${field.javaType} ${field.name};`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function buildEntityRelationships(meta: JavaClassMeta): string {
  return meta.relationships
    .map((rel) => {
      switch (rel.type) {
        case 'MANY_TO_ONE':
          return [
            '    @ManyToOne(fetch = FetchType.LAZY)',
            `    @JoinColumn(name = "${rel.joinColumnName}")`,
            `    private ${rel.targetClassName} ${rel.fieldName};`,
          ].join('\n');

        case 'ONE_TO_MANY':
          return [
            `    @OneToMany(mappedBy = "${rel.mappedBy}", cascade = CascadeType.ALL, orphanRemoval = true)`,
            '    @JsonIgnore',
            `    private List<${rel.targetClassName}> ${rel.fieldName} = new ArrayList<>();`,
          ].join('\n');

        case 'ONE_TO_ONE':
          return [
            '    @OneToOne(fetch = FetchType.LAZY)',
            `    @JoinColumn(name = "${rel.joinColumnName}")`,
            `    private ${rel.targetClassName} ${rel.fieldName};`,
          ].join('\n');

        case 'MANY_TO_MANY':
          return [
            '    @ManyToMany',
            '    @JoinTable(',
            `        name = "${meta.tableName}_${rel.fieldName}",`,
            `        joinColumns = @JoinColumn(name = "${meta.tableName}_id"),`,
            `        inverseJoinColumns = @JoinColumn(name = "${rel.fieldName}_id")`,
            '    )',
            '    @JsonIgnore',
            `    private List<${rel.targetClassName}> ${rel.fieldName} = new ArrayList<>();`,
          ].join('\n');

        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildEntityGettersAndSetters(meta: JavaClassMeta): string {
  const methods: string[] = [];

  // Getters y Setters para atributos regulares
  for (const field of meta.fields) {
    methods.push([
      `    public ${field.javaType} ${field.getterName}() {`,
      `        return ${field.name};`,
      '    }',
      '',
      `    public void ${field.setterName}(${field.javaType} ${field.name}) {`,
      `        this.${field.name} = ${field.name};`,
      '    }',
    ].join('\n'));
  }

  // Getters y Setters para relaciones
  for (const rel of meta.relationships) {
    const isCollection = rel.type === 'ONE_TO_MANY' || rel.type === 'MANY_TO_MANY';
    const type = isCollection ? `List<${rel.targetClassName}>` : rel.targetClassName;
    const capName = rel.fieldName.charAt(0).toUpperCase() + rel.fieldName.slice(1);

    methods.push([
      `    public ${type} get${capName}() {`,
      `        return ${rel.fieldName};`,
      '    }',
      '',
      `    public void set${capName}(${type} ${rel.fieldName}) {`,
      `        this.${rel.fieldName} = ${rel.fieldName};`,
      '    }',
    ].join('\n'));
  }

  return methods.join('\n\n');
}
