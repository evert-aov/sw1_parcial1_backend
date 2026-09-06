import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiagramVersion } from './entities/diagram-version.entity';
import { DiagramVersionRepository } from './repositories/diagram-version.repository';
import { XmiExporterService } from './services/xmi-exporter.service';
import { XmiParserService } from './services/xmi-parser.service';
import { XmiInteropService } from './services/xmi-interop.service';
import { DiagramVersionService } from './services/diagram-version.service';
import { XmiController } from './controllers/xmi.controller';
import { DiagramVersionController } from './controllers/diagram-version.controller';
import { DiagramsModule } from '../diagrams/diagrams.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiagramVersion]),
    DiagramsModule,
    ProjectsModule,
  ],
  controllers: [XmiController, DiagramVersionController],
  providers: [
    DiagramVersionRepository,
    XmiExporterService,
    XmiParserService,
    XmiInteropService,
    DiagramVersionService,
  ],
  exports: [
    XmiExporterService,
    XmiParserService,
    XmiInteropService,
    DiagramVersionService,
    DiagramVersionRepository,
  ],
})
export class XmiInteropModule {}
