import { Module } from '@nestjs/common';
import { XmiExporterService } from './services/xmi-exporter.service';
import { XmiParserService } from './services/xmi-parser.service';
import { XmiInteropService } from './services/xmi-interop.service';
import { XmiController } from './controllers/xmi.controller';
import { DiagramsModule } from '../diagrams/diagrams.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    DiagramsModule,
    ProjectsModule,
  ],
  controllers: [XmiController],
  providers: [
    XmiExporterService,
    XmiParserService,
    XmiInteropService,
  ],
  exports: [
    XmiExporterService,
    XmiParserService,
    XmiInteropService,
  ],
})
export class XmiInteropModule {}
