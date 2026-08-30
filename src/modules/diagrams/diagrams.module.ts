import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diagram } from './entities/diagram.entity';
import { UmlNode } from './entities/uml-node.entity';
import { UmlAttribute } from './entities/uml-attribute.entity';
import { UmlMethod } from './entities/uml-method.entity';
import { UmlConnection } from './entities/uml-connection.entity';
import { DiagramActivityLog } from './entities/diagram-activity-log.entity';
import { DiagramRepository } from './repositories/diagram.repository';
import { DiagramService } from './services/diagram.service';
import { DiagramController } from './controllers/diagram.controller';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Diagram,
      UmlNode,
      UmlAttribute,
      UmlMethod,
      UmlConnection,
      DiagramActivityLog,
    ]),
    ProjectsModule,
    AuthModule,
  ],
  controllers: [DiagramController],
  providers: [DiagramService, DiagramRepository],
  exports: [DiagramService, DiagramRepository],
})
export class DiagramsModule {}
