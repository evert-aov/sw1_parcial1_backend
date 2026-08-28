import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { User } from '../modules/auth/entities/user.entity';
import { Project } from '../modules/projects/entities/project.entity';
import { ProjectMember } from '../modules/projects/entities/project-member.entity';
import { Diagram } from '../modules/diagrams/entities/diagram.entity';
import { UmlNode } from '../modules/diagrams/entities/uml-node.entity';
import { UmlAttribute } from '../modules/diagrams/entities/uml-attribute.entity';
import { UmlMethod } from '../modules/diagrams/entities/uml-method.entity';
import { UmlConnection } from '../modules/diagrams/entities/uml-connection.entity';
import { DiagramVersion } from '../modules/xmi-interop/entities/diagram-version.entity';
import { AiAssistantLog } from '../modules/ai-assistant/entities/ai-assistant-log.entity';
import { CollaborationSession } from '../modules/collaboration/entities/collaboration-session.entity';
import { SessionParticipant } from '../modules/collaboration/entities/session-participant.entity';

export const ALL_ENTITIES = [
  User,
  Project,
  ProjectMember,
  Diagram,
  UmlNode,
  UmlAttribute,
  UmlMethod,
  UmlConnection,
  DiagramVersion,
  AiAssistantLog,
  CollaborationSession,
  SessionParticipant,
];

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'evert',
    password: process.env.DB_PASS || 'nakroth',
    database: process.env.DB_NAME || 'uml_studio_db',
    entities: ALL_ENTITIES,
    autoLoadEntities: true,
    synchronize: process.env.DB_SYNCHRONIZE === 'true' || process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING === 'true',
  }),
);
