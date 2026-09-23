import * as path from 'path';
import { ProjectContext } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderBuildGradle(context: ProjectContext): string {
  const templatePath = path.join(__dirname, 'build-gradle.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  return renderMustache(mustacheTemplate, {
    groupId: context.groupId || 'com.app',
    artifactId: context.artifactId || 'spring-boot-uml-api',
    // Spring Boot 3.4.0+ es obligatorio para compatibilidad binaria con Gradle 9.x (evita getDirMode en bootJar)
    springBootVersion:
      context.springBootVersion === '3.3.0' || !context.springBootVersion
        ? '3.4.0'
        : context.springBootVersion,
    javaVersion: context.javaVersion || '21',
  });
}

export function renderSettingsGradle(context: ProjectContext): string {
  const templatePath = path.join(__dirname, 'settings-gradle.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  return renderMustache(mustacheTemplate, {
    artifactId: context.artifactId || 'spring-boot-uml-api',
  });
}
