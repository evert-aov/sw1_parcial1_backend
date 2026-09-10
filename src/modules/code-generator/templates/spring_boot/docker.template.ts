import * as path from 'path';
import { ProjectContext } from './template-models';
import { loadTemplate, renderMustache } from '../mustache-renderer';

export function renderDockerfile(context: ProjectContext): string {
  const templatePath = path.join(__dirname, 'dockerfile.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  const javaVer = context.javaVersion === '17' ? '17' : '21';
  return renderMustache(mustacheTemplate, {
    javaVer,
    serverPort: context.serverPort || 8080,
  });
}

export function renderDockerCompose(context: ProjectContext): string {
  const templatePath = path.join(__dirname, 'docker-compose.template.mustache');
  const mustacheTemplate = loadTemplate(templatePath);

  return renderMustache(mustacheTemplate, {
    artifactId: context.artifactId,
    databaseName: context.databaseName || 'app_db',
    databaseUser: context.databaseUser || 'postgres',
    databasePassword: context.databasePassword || 'postgres',
    databasePort: context.databasePort || 5432,
    serverPort: context.serverPort || 8080,
    hasAuth: context.hasAuth,
  });
}
