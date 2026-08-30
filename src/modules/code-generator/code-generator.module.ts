import { Module } from '@nestjs/common';
import { CodeGeneratorController } from './controllers/code-generator.controller';
import { CodeGeneratorService } from './services/code-generator.service';
import { SpringTemplateEngineService } from './services/spring-template-engine.service';
import { ZipArchiverService } from './services/zip-archiver.service';
import { FlutterTemplateEngineService } from './services/flutter-template-engine.service';
import { DiagramsModule } from '../diagrams/diagrams.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [DiagramsModule, ProjectsModule],
  controllers: [CodeGeneratorController],
  providers: [
    CodeGeneratorService,
    SpringTemplateEngineService,
    FlutterTemplateEngineService,
    ZipArchiverService,
  ],
  exports: [CodeGeneratorService, SpringTemplateEngineService, FlutterTemplateEngineService, ZipArchiverService],
})
export class CodeGeneratorModule {}
