import { JavaClassMeta } from './template-models';

export function renderEntity(meta: JavaClassMeta): string {
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

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  const fieldsBlock = meta.fields
    .map((field) => {
      if (field.isId) {
        if (field.javaType === 'UUID') {
          return `    @Id\n    @GeneratedValue(strategy = GenerationType.UUID)\n    @Column(name = "${field.sqlColumnName}", updatable = false, nullable = false)\n    private ${field.javaType} ${field.name};`;
        }
        return `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    @Column(name = "${field.sqlColumnName}", updatable = false, nullable = false)\n    private ${field.javaType} ${field.name};`;
      }

      const annotations: string[] = [];
      if (!field.isNullable) {
        if (field.javaType === 'String') {
          annotations.push(`    @NotBlank(message = "El campo '${field.name}' es obligatorio")`);
        } else {
          annotations.push(`    @NotNull(message = "El campo '${field.name}' no puede ser nulo")`);
        }
      }
      if (field.isUnique) {
        annotations.push(`    @Column(name = "${field.sqlColumnName}", unique = true)`);
      } else {
        annotations.push(`    @Column(name = "${field.sqlColumnName}")`);
      }

      return `${annotations.join('\n')}\n    private ${field.javaType} ${field.name};`;
    })
    .join('\n\n');

  const relationshipsBlock = meta.relationships
    .map((rel) => {
      if (rel.type === 'MANY_TO_ONE') {
        return `    @ManyToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = "${rel.joinColumnName}")\n    private ${rel.targetClassName} ${rel.fieldName};`;
      }
      if (rel.type === 'ONE_TO_MANY') {
        return `    @OneToMany(mappedBy = "${rel.mappedBy}", cascade = CascadeType.ALL, orphanRemoval = true)\n    @JsonIgnore\n    private List<${rel.targetClassName}> ${rel.fieldName} = new ArrayList<>();`;
      }
      if (rel.type === 'ONE_TO_ONE') {
        return `    @OneToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = "${rel.joinColumnName}")\n    private ${rel.targetClassName} ${rel.fieldName};`;
      }
      if (rel.type === 'MANY_TO_MANY') {
        return `    @ManyToMany\n    @JoinTable(\n        name = "${meta.tableName}_${rel.fieldName}",\n        joinColumns = @JoinColumn(name = "${meta.tableName}_id"),\n        inverseJoinColumns = @JoinColumn(name = "${rel.fieldName}_id")\n    )\n    @JsonIgnore\n    private List<${rel.targetClassName}> ${rel.fieldName} = new ArrayList<>();`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  const gettersAndSetters = [
    ...meta.fields.map((field) => {
      return `    public ${field.javaType} ${field.getterName}() {\n        return ${field.name};\n    }\n\n    public void ${field.setterName}(${field.javaType} ${field.name}) {\n        this.${field.name} = ${field.name};\n    }`;
    }),
    ...meta.relationships.map((rel) => {
      const type = rel.type === 'ONE_TO_MANY' || rel.type === 'MANY_TO_MANY' ? `List<${rel.targetClassName}>` : rel.targetClassName;
      const capName = rel.fieldName.charAt(0).toUpperCase() + rel.fieldName.slice(1);
      return `    public ${type} get${capName}() {\n        return ${rel.fieldName};\n    }\n\n    public void set${capName}(${type} ${rel.fieldName}) {\n        this.${rel.fieldName} = ${rel.fieldName};\n    }`;
    }),
  ].join('\n\n');

  return `package ${meta.basePackage}.entities;

${importStatements}

/**
 * Entidad JPA para la tabla '${meta.tableName}'.
 * Generada automáticamente por UML Studio Architecture Generator.
 */
@Entity
@Table(name = "${meta.tableName}")
public class ${meta.className} {

${fieldsBlock}

${relationshipsBlock ? relationshipsBlock + '\n\n' : ''}    public ${meta.className}() {
    }

${gettersAndSetters}
}
`;
}
