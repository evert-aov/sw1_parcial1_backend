import { Injectable } from '@nestjs/common';
import {
  JavaClassMeta,
  JavaField,
  JavaRelationship,
  ProjectContext,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toSingular,
  mapTypeToSql,
  normalizeJavaType,
} from '../templates/spring_boot/template-models';
import { renderEntity } from '../templates/spring_boot/entity.template';
import { renderRepository } from '../templates/spring_boot/repository.template';
import {
  renderCreateDto,
  renderUpdateDto,
  renderResponseDto,
} from '../templates/spring_boot/dto.template';
import {
  renderService,
} from '../templates/spring_boot/service.template';
import { renderController } from '../templates/spring_boot/controller.template';
import {
  renderResourceNotFoundException,
  renderGlobalExceptionHandler,
} from '../templates/spring_boot/exception.template';
import { renderFlywayMigration } from '../templates/spring_boot/flyway.template';
import { renderBuildGradle, renderSettingsGradle } from '../templates/spring_boot/gradle.template';
import { renderApplicationYml } from '../templates/spring_boot/application-yml.template';
import { renderMainApplication } from '../templates/spring_boot/main-application.template';
import {
  renderDockerfile,
  renderDockerCompose,
  renderDockerfileLocal,
  renderDockerComposeLocal,
} from '../templates/spring_boot/docker.template';
import { renderReadme } from '../templates/spring_boot/readme.template';
import { generateProjectSeedData } from '../templates/spring_boot/fake-data.helper';
import { renderFlywaySeedData } from '../templates/spring_boot/flyway-seed.template';
import { renderPostmanCollection } from '../templates/spring_boot/postman.template';
import { GeneratedFileDto } from '../dtos/code-generation-preview-response.dto';
import { GenerateCodeRequestDto } from '../dtos/generate-code-request.dto';

@Injectable()
export class SpringTemplateEngineService {
  /**
   * Procesa el AST del diagrama y genera todos los archivos del microservicio Spring Boot.
   */
  generateProjectFiles(
    dto: GenerateCodeRequestDto,
    nodes: any[],
    connections: any[],
  ): { context: ProjectContext; files: GeneratedFileDto[] } {
    const packageName = (dto.packageName || 'com.app.studio').trim().toLowerCase();
    const artifactId = (dto.artifactId || 'spring-boot-uml-api').trim().toLowerCase();
    const groupId = (dto.groupId || 'com.app').trim().toLowerCase();
    const projectName = dto.projectName || 'Spring Boot UML Microservice';
    const javaVersion = dto.javaVersion || '21';
    const springBootVersion = dto.springBootVersion || '3.4.0';
    const databaseName = dto.databaseName || 'app_db';
    const databaseUser = dto.databaseUser || 'postgres';
    const databasePassword = dto.databasePassword || 'postgres';
    const databasePort = dto.databasePort || 5432;
    const serverPort = dto.serverPort || 8080;

    // 1. Filtrar nodos válidos (excluyendo anclas invisibles)
    const validNodes = (nodes || []).filter((n) => !n.isAnchor && n.name && n.name.trim().length > 0);

    // Mapeo id de nodo -> nombre de clase
    const nodeIdToNameMap = new Map<string, string>();
    for (const node of validNodes) {
      nodeIdToNameMap.set(node.id, toPascalCase(node.name));
    }

    // Mapeo previo de herencia (generalization / inheritance)
    // conn.sourceNodeId -> Subclase (Hijo, ej: Empleado)
    // conn.targetNodeId -> Superclase (Padre, ej: Usuario)
    const childToParentMap = new Map<string, string>();
    const parentToChildrenMap = new Map<string, string[]>();

    for (const conn of connections || []) {
      if (conn.type === 'generalization') {
        const sId = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const tId = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');
        if (sId && tId && sId !== tId) {
          childToParentMap.set(sId, tId);
          const children = parentToChildrenMap.get(tId) || [];
          children.push(sId);
          parentToChildrenMap.set(tId, children);
        }
      }
    }

    // 2. Extraer metadatos de clases y relaciones
    const classes: JavaClassMeta[] = validNodes.map((node) => {
      const isInheritanceChild = childToParentMap.has(node.id);
      const isInheritanceParent = parentToChildrenMap.has(node.id);
      const parentNodeId = childToParentMap.get(node.id);
      const parentNode = parentNodeId ? validNodes.find((n) => n.id === parentNodeId) : undefined;
      const superClassName = parentNode ? toPascalCase(parentNode.name) : undefined;

      const className = toPascalCase(node.name);
      // En SINGLE_TABLE, la entidad hija se mapea a la tabla de la entidad padre
      const tableName = isInheritanceChild && parentNode ? toSnakeCase(parentNode.name) : toSnakeCase(node.name);
      const endpointPath = toSnakeCase(node.name).replace(/_/g, '-');

      let discriminatorColumnName: string | undefined;
      let discriminatorValue: string | undefined;
      let discriminatorFieldName: string | undefined;

      if (isInheritanceParent) {
        discriminatorColumnName = `tipo_${toSnakeCase(toSingular(node.name))}`;
        discriminatorValue = `${toSnakeCase(toSingular(node.name)).toUpperCase()}_BASE`;
        discriminatorFieldName = toCamelCase(discriminatorColumnName);
      } else if (isInheritanceChild) {
        discriminatorValue = toSnakeCase(toSingular(node.name)).toUpperCase();
      }

      // Campos / Atributos
      const rawAttrs = node.attributes || [];
      const fields: JavaField[] = [];
      let hasId = false;

      for (const attr of rawAttrs) {
        const rawName = attr.name || 'campo';
        const rawLower = rawName.toLowerCase();
        const tableLower = tableName.toLowerCase();

        let singularTable = tableLower;
        if (tableLower.endsWith('ies')) {
          singularTable = tableLower.slice(0, -3) + 'y';
        } else if (tableLower.endsWith('es')) {
          singularTable = tableLower.slice(0, -2);
        } else if (tableLower.endsWith('s')) {
          singularTable = tableLower.slice(0, -1);
        }

        const rawClean = rawLower.replace(/[^a-z0-9]/g, '');
        const tableClean = tableLower.replace(/[^a-z0-9]/g, '');
        const singularClean = singularTable.replace(/[^a-z0-9]/g, '');

        const isId =
          rawLower === 'id' ||
          rawLower === `${tableLower}_id` ||
          rawLower === `id_${tableLower}` ||
          rawLower === `${singularTable}_id` ||
          rawLower === `id_${singularTable}` ||
          rawClean === 'id' ||
          rawClean === `${tableClean}id` ||
          rawClean === `id${tableClean}` ||
          rawClean === `${singularClean}id` ||
          rawClean === `id${singularClean}` ||
          toSnakeCase(rawName) === 'id' ||
          toSnakeCase(rawName) === `${tableLower}_id` ||
          toSnakeCase(rawName) === `${singularTable}_id`;
        const javaType = normalizeJavaType(attr.type || (isId ? 'UUID' : 'String'));
        const fieldName = toCamelCase(rawName);

        if (isId) hasId = true;

        fields.push({
          name: fieldName,
          javaType,
          sqlColumnName: toSnakeCase(rawName),
          sqlType: mapTypeToSql(javaType),
          isId,
          isNullable: isId ? false : attr.isNullable ?? true,
          isUnique: isId ? true : attr.isUnique ?? false,
          isAutoIncrement: attr.isAutoIncrement ?? false,
          getterName: 'get' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
          setterName: 'set' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
        });
      }

      // Si no definió un campo ID explícito, creamos 'id: UUID' por defecto
      let idField: JavaField;
      if (!hasId) {
        idField = {
          name: 'id',
          javaType: 'UUID',
          sqlColumnName: 'id',
          sqlType: 'UUID',
          isId: true,
          isNullable: false,
          isUnique: true,
          isAutoIncrement: false,
          getterName: 'getId',
          setterName: 'setId',
        };
        fields.unshift(idField);
      } else {
        idField = fields.find((f) => f.isId)!;
      }

      // Métodos
      const methods = (node.methods || []).map((m: any) => ({
        name: toCamelCase(m.name || 'operacion'),
        parameters: m.parameters || '',
        returnType: normalizeJavaType(m.returnType || 'void'),
      }));

      // Relaciones que involucran a esta clase
      const relationships: JavaRelationship[] = [];
      for (const conn of connections || []) {
        if (conn.type === 'generalization' || conn.type === 'inheritance') continue;

        const sourceBaseId = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const targetBaseId = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');

        const isSource = sourceBaseId === node.id;
        const isTarget = targetBaseId === node.id;

        if (!isSource && !isTarget) continue;

        const isSelf = sourceBaseId === targetBaseId;
        const targetNodeId = isSource ? targetBaseId : sourceBaseId;
        const targetClassName = nodeIdToNameMap.get(targetNodeId);
        if (!targetClassName) continue;

        if (isSelf) {
          const relType = conn.type || 'association';
          const sourceMult = conn.sourceMultiplicity || '1';
          const targetMult = conn.targetMultiplicity || '0..*';

          const sourceIsMany = sourceMult.includes('*') || sourceMult.includes('n') || sourceMult.includes('m');
          const targetIsMany = targetMult.includes('*') || targetMult.includes('n') || targetMult.includes('m');

          if (sourceIsMany && targetIsMany) {
            relationships.push({
              type: 'MANY_TO_MANY',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: 'related' + className + 'List',
              sourceMultiplicity: sourceMult,
              targetMultiplicity: targetMult,
            });
          } else {
            relationships.push({
              type: 'MANY_TO_ONE',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: 'parent' + className,
              joinColumnName: 'parent_id',
              sourceMultiplicity: sourceMult,
              targetMultiplicity: targetMult,
            });

            relationships.push({
              type: 'ONE_TO_MANY',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: 'child' + className + 'List',
              mappedBy: 'parent' + className,
              sourceMultiplicity: targetMult,
              targetMultiplicity: sourceMult,
            });
          }
          continue;
        }

        if (targetClassName === className) continue;

        const relType = conn.type || 'association';
        const sourceMult = conn.sourceMultiplicity || '1';
        const targetMult = conn.targetMultiplicity || '1..*';

        const sourceIsMany = sourceMult.includes('*') || sourceMult.includes('n') || sourceMult.includes('m');
        const targetIsMany = targetMult.includes('*') || targetMult.includes('n') || targetMult.includes('m');

        if (sourceIsMany && targetIsMany) {
          // N:M
          relationships.push({
            type: 'MANY_TO_MANY',
            targetClassName,
            targetPackage: `${packageName}.entities`,
            fieldName: toCamelCase(targetClassName) + 'List',
            sourceMultiplicity: isSource ? sourceMult : targetMult,
            targetMultiplicity: isSource ? targetMult : sourceMult,
          });
        } else if (isSource) {
          if (targetIsMany) {
            // 1:N -> En el lado origen es ONE_TO_MANY
            relationships.push({
              type: 'ONE_TO_MANY',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(targetClassName) + 'List',
              mappedBy: toCamelCase(toSingular(className)),
              sourceMultiplicity: sourceMult,
              targetMultiplicity: targetMult,
            });
          } else {
            // N:1 o 1:1 -> En el lado origen es MANY_TO_ONE
            const { joinColumnName, matchedField } = findMatchingForeignKeyField(targetClassName, fields);
            if (matchedField) matchedField.isForeignKey = true;
            relationships.push({
              type: 'MANY_TO_ONE',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(toSingular(targetClassName)),
              joinColumnName,
              sourceMultiplicity: sourceMult,
              targetMultiplicity: targetMult,
            });
          }
        } else {
          // Lado destino (isTarget)
          if (targetIsMany) {
            // El lado destino es el 'Many' en 1:N -> Genera @MANY_TO_ONE
            const { joinColumnName, matchedField } = findMatchingForeignKeyField(targetClassName, fields);
            if (matchedField) matchedField.isForeignKey = true;
            relationships.push({
              type: 'MANY_TO_ONE',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(toSingular(targetClassName)),
              joinColumnName,
              sourceMultiplicity: targetMult,
              targetMultiplicity: sourceMult,
            });
          } else if (sourceIsMany) {
            // El lado destino es el 'One' en N:1 -> Genera @ONE_TO_MANY
            relationships.push({
              type: 'ONE_TO_MANY',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(targetClassName) + 'List',
              mappedBy: toCamelCase(toSingular(className)),
              sourceMultiplicity: targetMult,
              targetMultiplicity: sourceMult,
            });
          } else {
            // 1:1
            const { joinColumnName, matchedField } = findMatchingForeignKeyField(targetClassName, fields);
            if (matchedField) matchedField.isForeignKey = true;
            relationships.push({
              type: 'ONE_TO_ONE',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(toSingular(targetClassName)),
              joinColumnName,
              sourceMultiplicity: targetMult,
              targetMultiplicity: sourceMult,
            });
          }
        }
      }

      // Marcar cualquier campo que coincida con joinColumnName de una relación
      for (const rel of relationships) {
        if (rel.joinColumnName) {
          const colLower = rel.joinColumnName.toLowerCase();
          for (const f of fields) {
            if (!f.isId && f.sqlColumnName.toLowerCase() === colLower) {
              f.isForeignKey = true;
            }
          }
        }
      }

      const hasDates = fields.some((f) => f.javaType === 'LocalDate' || f.javaType === 'LocalDateTime');
      const hasUuids = true;
      const hasBigDecimals = fields.some((f) => f.javaType === 'BigDecimal');

      return {
        className,
        tableName,
        packageName: `${packageName}.entities`,
        basePackage: packageName,
        idField,
        fields,
        methods,
        relationships,
        hasDates,
        hasUuids,
        hasBigDecimals,
        endpointPath,
        isInheritanceParent,
        isInheritanceChild,
        superClassName,
        discriminatorColumnName,
        discriminatorValue,
        discriminatorFieldName,
      };
    });

    // 2.0. Enlazar datos de herencia (ID e inheritedFields) para subclases
    for (const cls of classes) {
      if (cls.isInheritanceChild && cls.superClassName) {
        const parentCls = classes.find((c) => c.className === cls.superClassName);
        if (parentCls) {
          cls.idField = { ...parentCls.idField };
          cls.discriminatorColumnName = parentCls.discriminatorColumnName;
          cls.discriminatorFieldName = parentCls.discriminatorFieldName;
          cls.inheritedFields = parentCls.fields.filter((f) => !f.isId);
          // Eliminar el id propio generado si la subclase no lo define como propio
          cls.fields = cls.fields.filter((f) => !f.isId);
        }
      }
    }

    // 2.1. Resolver tipos de ID y getters/setters para relaciones foráneas
    for (const cls of classes) {
      for (const rel of cls.relationships) {
        const targetCls = classes.find((c) => c.className === rel.targetClassName);
        if (targetCls && targetCls.idField) {
          rel.targetIdType = targetCls.idField.javaType;
          rel.targetIdGetterName = targetCls.idField.getterName;
          rel.targetIdSetterName = targetCls.idField.setterName;
        } else {
          rel.targetIdType = 'UUID';
          rel.targetIdGetterName = 'getId';
          rel.targetIdSetterName = 'setId';
        }
      }
    }

    const context: ProjectContext = {
      packageName,
      artifactId,
      groupId,
      projectName,
      javaVersion,
      springBootVersion,
      databaseName,
      databaseUser,
      databasePassword,
      databasePort,
      serverPort,
      classes,
    };

    // 3. Renderizar archivos de todas las capas
    const files: GeneratedFileDto[] = [];
    const packagePath = 'src/main/java/' + packageName.replace(/\./g, '/');

    // Capa 1: Entidades JPA
    for (const meta of classes) {
      files.push({
        path: `${packagePath}/entities/${meta.className}.java`,
        filename: `${meta.className}.java`,
        language: 'java',
        layer: 'entity',
        content: renderEntity(meta),
      });
    }

    // Capa 2: Repositorios Spring Data JPA
    for (const meta of classes) {
      files.push({
        path: `${packagePath}/repositories/${meta.className}Repository.java`,
        filename: `${meta.className}Repository.java`,
        language: 'java',
        layer: 'repository',
        content: renderRepository(meta),
      });
    }

    // Capa 3: DTOs
    for (const meta of classes) {
      files.push({
        path: `${packagePath}/dtos/Create${meta.className}Dto.java`,
        filename: `Create${meta.className}Dto.java`,
        language: 'java',
        layer: 'dto',
        content: renderCreateDto(meta),
      });
      files.push({
        path: `${packagePath}/dtos/Update${meta.className}Dto.java`,
        filename: `Update${meta.className}Dto.java`,
        language: 'java',
        layer: 'dto',
        content: renderUpdateDto(meta),
      });
      files.push({
        path: `${packagePath}/dtos/${meta.className}ResponseDto.java`,
        filename: `${meta.className}ResponseDto.java`,
        language: 'java',
        layer: 'dto',
        content: renderResponseDto(meta),
      });
    }

    // Capa 4: Servicios (directamente en capa service, sin impl)
    for (const meta of classes) {
      files.push({
        path: `${packagePath}/services/${meta.className}Service.java`,
        filename: `${meta.className}Service.java`,
        language: 'java',
        layer: 'service',
        content: renderService(meta),
      });
    }

    // Capa 5: Controladores REST con Swagger UI
    for (const meta of classes) {
      files.push({
        path: `${packagePath}/controllers/${meta.className}Controller.java`,
        filename: `${meta.className}Controller.java`,
        language: 'java',
        layer: 'controller',
        content: renderController(meta),
      });
    }

    // Configuración WebMvc y CORS (Permitir llamadas de cualquier cliente sin restricciones de seguridad)
    files.push({
      path: `${packagePath}/config/WebConfig.java`,
      filename: 'WebConfig.java',
      language: 'java',
      layer: 'config',
      content: `package ${packageName}.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
`,
    });

    // Excepciones Globales
    files.push({
      path: `${packagePath}/exceptions/ResourceNotFoundException.java`,
      filename: 'ResourceNotFoundException.java',
      language: 'java',
      layer: 'config',
      content: renderResourceNotFoundException(packageName),
    });
    files.push({
        path: `${packagePath}/exceptions/GlobalExceptionHandler.java`,
        filename: 'GlobalExceptionHandler.java',
        language: 'java',
        layer: 'config',
        content: renderGlobalExceptionHandler(packageName),
      });

    // Clase Principal Spring Boot
    const appClassName = artifactId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'Application';

    files.push({
      path: `${packagePath}/${appClassName}.java`,
      filename: `${appClassName}.java`,
      language: 'java',
      layer: 'config',
      content: renderMainApplication(context),
    });

    // Script de Migración Flyway (Esquema)
    files.push({
      path: 'src/main/resources/db/migration/V1__create_tables.sql',
      filename: 'V1__create_tables.sql',
      language: 'sql',
      layer: 'migration',
      content: renderFlywayMigration(context),
    });

    // Generación de Datos Falsos Deterministas (Seed Data para pruebas inmediatas)
    const seededData = generateProjectSeedData(classes);

    // Script de Datos de Prueba Iniciales (Flyway V2)
    files.push({
      path: 'src/main/resources/db/migration/V2__seed_data.sql',
      filename: 'V2__seed_data.sql',
      language: 'sql',
      layer: 'migration',
      content: renderFlywaySeedData(context, seededData),
    });

    // Colección de Postman completa con variables, endpoints CRUD y cuerpos de prueba
    files.push({
      path: 'postman/postman_collection.json',
      filename: 'postman_collection.json',
      language: 'json',
      layer: 'docs',
      content: renderPostmanCollection(context, seededData),
    });

    // Configuración application.yml
    files.push({
      path: 'src/main/resources/application.yml',
      filename: 'application.yml',
      language: 'yaml',
      layer: 'config',
      content: renderApplicationYml(context),
    });

    // Build Gradle (build.gradle y settings.gradle)
    files.push({
      path: 'build.gradle',
      filename: 'build.gradle',
      language: 'groovy',
      layer: 'config',
      content: renderBuildGradle(context),
    });
    files.push({
      path: 'settings.gradle',
      filename: 'settings.gradle',
      language: 'groovy',
      layer: 'config',
      content: renderSettingsGradle(context),
    });

    // Dockerfile & docker-compose.yml (Modo autónomo desde cero)
    files.push({
      path: 'Dockerfile',
      filename: 'Dockerfile',
      language: 'dockerfile',
      layer: 'docker',
      content: renderDockerfile(context),
    });
    files.push({
      path: 'docker-compose.yml',
      filename: 'docker-compose.yml',
      language: 'yaml',
      layer: 'docker',
      content: renderDockerCompose(context),
    });

    // Dockerfile.local & docker-compose.local.yml (Modo local aprovechando herramientas del host)
    files.push({
      path: 'Dockerfile.local',
      filename: 'Dockerfile.local',
      language: 'dockerfile',
      layer: 'docker',
      content: renderDockerfileLocal(context),
    });
    files.push({
      path: 'docker-compose.local.yml',
      filename: 'docker-compose.local.yml',
      language: 'yaml',
      layer: 'docker',
      content: renderDockerComposeLocal(context),
    });

    // Documentación README.md
    files.push({
      path: 'README.md',
      filename: 'README.md',
      language: 'markdown',
      layer: 'docs',
      content: renderReadme(context),
    });

    return { context, files };
  }
}

function findMatchingForeignKeyField(
  targetClassName: string,
  fields: JavaField[],
): { joinColumnName: string; matchedField?: JavaField } {
  const targetSnake = toSnakeCase(targetClassName);

  const candidates = new Set<string>();
  candidates.add(`${targetSnake}_id`);
  candidates.add(targetSnake);
  candidates.add(`id_${targetSnake}`);

  let singular = targetSnake;
  if (targetSnake.endsWith('ies')) {
    singular = targetSnake.slice(0, -3) + 'y';
  } else if (targetSnake.endsWith('es')) {
    singular = targetSnake.slice(0, -2);
  } else if (targetSnake.endsWith('s')) {
    singular = targetSnake.slice(0, -1);
  }
  if (singular !== targetSnake) {
    candidates.add(`${singular}_id`);
    candidates.add(singular);
    candidates.add(`id_${singular}`);
  }

  const matched = fields.find((f) => {
    if (f.isId) return false;
    const colName = f.sqlColumnName.toLowerCase();
    const cleanFieldName = f.name.toLowerCase().replace(/_/g, '');
    for (const cand of candidates) {
      if (colName === cand || cleanFieldName === cand.replace(/_/g, '')) {
        return true;
      }
    }
    return false;
  });

  if (matched) {
    return { joinColumnName: matched.sqlColumnName, matchedField: matched };
  }

  return { joinColumnName: `${singular}_id` };
}

