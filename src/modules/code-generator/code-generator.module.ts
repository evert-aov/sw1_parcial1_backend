import { Module } from '@nestjs/common';
import { CodeGeneratorController } from './controllers/code-generator.controller';
import { CodeGeneratorService } from './services/code-generator.service';
import { SpringTemplateEngineService } from './services/spring-template-engine.service';
import { ZipArchiverService } from './services/zip-archiver.service';
import { DiagramsModule } from '../diagrams/diagrams.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [DiagramsModule, ProjectsModule],
  controllers: [CodeGeneratorController],
  providers: [
    CodeGeneratorService,
    SpringTemplateEngineService,
    ZipArchiverService,
  ],
  exports: [CodeGeneratorService, SpringTemplateEngineService, ZipArchiverService],
})
export class CodeGeneratorModule {}
