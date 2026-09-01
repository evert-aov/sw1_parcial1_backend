import { Injectable } from '@nestjs/common';
import {
  JavaClassMeta,
  JavaField,
  JavaRelationship,
  ProjectContext,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  mapTypeToSql,
  normalizeJavaType,
  isUserClass,
  isAuthEligibleUserClass,
} from '../templates/spring_boot/template-models';
import { renderEntity } from '../templates/spring_boot/entity.template';
import { renderRepository } from '../templates/spring_boot/repository.template';
import {
  renderCreateDto,
  renderUpdateDto,
  renderResponseDto,
} from '../templates/spring_boot/dto.template';
import {
  renderServiceInterface,
  renderServiceImpl,
} from '../templates/spring_boot/service.template';
import { renderController } from '../templates/spring_boot/controller.template';
import {
  renderResourceNotFoundException,
  renderGlobalExceptionHandler,
} from '../templates/spring_boot/exception.template';
import { renderFlywayMigration } from '../templates/spring_boot/flyway.template';
import { renderPomXml } from '../templates/spring_boot/pom-xml.template';
import { renderApplicationYml } from '../templates/spring_boot/application-yml.template';
import { renderMainApplication } from '../templates/spring_boot/main-application.template';
import { renderDockerfile, renderDockerCompose } from '../templates/spring_boot/docker.template';
import { renderReadme } from '../templates/spring_boot/readme.template';
import {
  renderJwtTokenProvider,
  renderUserPrincipal,
  renderCustomUserDetailsService,
  renderJwtAuthenticationFilter,
  renderSecurityConfig,
  renderLoginRequestDto,
  renderRegisterRequestDto,
  renderAuthResponseDto,
  renderAuthServiceInterface,
  renderAuthServiceImpl,
  renderAuthController,
  renderDataInitializer,
} from '../templates/spring_boot/security.template';
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

    // 2. Extraer metadatos de clases y relaciones
    const classes: JavaClassMeta[] = validNodes.map((node) => {
      const className = toPascalCase(node.name);
      const tableName = toSnakeCase(node.name);

      // Campos / Atributos
      const rawAttrs = node.attributes || [];
      const fields: JavaField[] = [];
      let hasId = false;

      for (const attr of rawAttrs) {
        const rawName = attr.name || 'campo';
        const isId = rawName.toLowerCase() === 'id' || rawName.toLowerCase() === `${tableName}_id`;
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
        const sourceBaseId = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
        const targetBaseId = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');

        const isSource = sourceBaseId === node.id;
        const isTarget = targetBaseId === node.id;

        if (!isSource && !isTarget) continue;

        const targetNodeId = isSource ? targetBaseId : sourceBaseId;
        const targetClassName = nodeIdToNameMap.get(targetNodeId);
        if (!targetClassName || targetClassName === className) continue;

        const relType = conn.type || 'association';
        const sourceMult = conn.sourceMultiplicity || '1';
        const targetMult = conn.targetMultiplicity || '1..*';

        if (isSource) {
          // Lado origen
          if (targetMult.includes('*') || targetMult.includes('n') || targetMult.includes('m')) {
            if (sourceMult.includes('*') || sourceMult.includes('n') || sourceMult.includes('m')) {
              // N:M
              relationships.push({
                type: 'MANY_TO_MANY',
                targetClassName,
                targetPackage: `${packageName}.entities`,
                fieldName: toCamelCase(targetClassName) + 'List',
                sourceMultiplicity: sourceMult,
                targetMultiplicity: targetMult,
              });
            } else {
              // 1:N -> En el lado origen es ONE_TO_MANY
              relationships.push({
                type: 'ONE_TO_MANY',
                targetClassName,
                targetPackage: `${packageName}.entities`,
                fieldName: toCamelCase(targetClassName) + 'List',
                mappedBy: toCamelCase(className),
                sourceMultiplicity: sourceMult,
                targetMultiplicity: targetMult,
              });
            }
          } else {
            // N:1 o 1:1
            relationships.push({
              type: 'MANY_TO_ONE',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(targetClassName),
              joinColumnName: `${toSnakeCase(targetClassName)}_id`,
              sourceMultiplicity: sourceMult,
              targetMultiplicity: targetMult,
            });
          }
        } else {
          // Lado destino
          if (targetMult.includes('*') || targetMult.includes('n') || targetMult.includes('m')) {
            // El lado destino es el 'Many' en 1:N -> Genera @ManyToOne
            relationships.push({
              type: 'MANY_TO_ONE',
              targetClassName,
              targetPackage: `${packageName}.entities`,
              fieldName: toCamelCase(targetClassName),
              joinColumnName: `${toSnakeCase(targetClassName)}_id`,
              sourceMultiplicity: targetMult,
              targetMultiplicity: sourceMult,
            });
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
      };
    });

    const userClass = classes.find((c) => isAuthEligibleUserClass(c));
    const hasAuth = !!userClass;

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
      hasAuth,
      userClass,
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

    // Capa 4: Servicios
    for (const meta of classes) {
      files.push({
        path: `${packagePath}/services/${meta.className}Service.java`,
        filename: `${meta.className}Service.java`,
        language: 'java',
        layer: 'service',
        content: renderServiceInterface(meta),
      });
      files.push({
        path: `${packagePath}/services/impl/${meta.className}ServiceImpl.java`,
        filename: `${meta.className}ServiceImpl.java`,
        language: 'java',
        layer: 'service',
        content: renderServiceImpl(meta),
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

    // Módulo Especial: Autenticación JWT & Spring Security (si existe clase de usuario)
    if (hasAuth && userClass) {
      files.push({
        path: `${packagePath}/security/JwtTokenProvider.java`,
        filename: 'JwtTokenProvider.java',
        language: 'java',
        layer: 'config',
        content: renderJwtTokenProvider(context, userClass),
      });
      files.push({
        path: `${packagePath}/security/UserPrincipal.java`,
        filename: 'UserPrincipal.java',
        language: 'java',
        layer: 'config',
        content: renderUserPrincipal(context, userClass),
      });
      files.push({
        path: `${packagePath}/security/CustomUserDetailsService.java`,
        filename: 'CustomUserDetailsService.java',
        language: 'java',
        layer: 'config',
        content: renderCustomUserDetailsService(context, userClass),
      });
      files.push({
        path: `${packagePath}/security/JwtAuthenticationFilter.java`,
        filename: 'JwtAuthenticationFilter.java',
        language: 'java',
        layer: 'config',
        content: renderJwtAuthenticationFilter(context),
      });
      files.push({
        path: `${packagePath}/security/SecurityConfig.java`,
        filename: 'SecurityConfig.java',
        language: 'java',
        layer: 'config',
        content: renderSecurityConfig(context),
      });
      files.push({
        path: `${packagePath}/dtos/auth/LoginRequestDto.java`,
        filename: 'LoginRequestDto.java',
        language: 'java',
        layer: 'dto',
        content: renderLoginRequestDto(context),
      });
      files.push({
        path: `${packagePath}/dtos/auth/RegisterRequestDto.java`,
        filename: 'RegisterRequestDto.java',
        language: 'java',
        layer: 'dto',
        content: renderRegisterRequestDto(context, userClass),
      });
      files.push({
        path: `${packagePath}/dtos/auth/AuthResponseDto.java`,
        filename: 'AuthResponseDto.java',
        language: 'java',
        layer: 'dto',
        content: renderAuthResponseDto(context, userClass),
      });
      files.push({
        path: `${packagePath}/services/AuthService.java`,
        filename: 'AuthService.java',
        language: 'java',
        layer: 'service',
        content: renderAuthServiceInterface(context),
      });
      files.push({
        path: `${packagePath}/services/impl/AuthServiceImpl.java`,
        filename: 'AuthServiceImpl.java',
        language: 'java',
        layer: 'service',
        content: renderAuthServiceImpl(context, userClass),
      });
      files.push({
        path: `${packagePath}/controllers/AuthController.java`,
        filename: 'AuthController.java',
        language: 'java',
        layer: 'controller',
        content: renderAuthController(context, userClass),
      });
      files.push({
        path: `${packagePath}/security/DataInitializer.java`,
        filename: 'DataInitializer.java',
        language: 'java',
        layer: 'config',
        content: renderDataInitializer(context, userClass),
      });
    }

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

    // Script de Migración Flyway
    files.push({
      path: 'src/main/resources/db/migration/V1__create_tables.sql',
      filename: 'V1__create_tables.sql',
      language: 'sql',
      layer: 'migration',
      content: renderFlywayMigration(context),
    });

    // Configuración application.yml
    files.push({
      path: 'src/main/resources/application.yml',
      filename: 'application.yml',
      language: 'yaml',
      layer: 'config',
      content: renderApplicationYml(context),
    });

    // Build Maven pom.xml
    files.push({
      path: 'pom.xml',
      filename: 'pom.xml',
      language: 'xml',
      layer: 'config',
      content: renderPomXml(context),
    });

    // Dockerfile & docker-compose.yml
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
