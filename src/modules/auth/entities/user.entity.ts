import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Project } from '../../projects/entities/project.entity';
import type { ProjectMember } from '../../projects/entities/project-member.entity';
import type { DiagramVersion } from '../../xmi-interop/entities/diagram-version.entity';
import type { AiAssistantLog } from '../../ai-assistant/entities/ai-assistant-log.entity';
import type { SessionParticipant } from '../../collaboration/entities/session-participant.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany('Project', (project: Project) => project.creator)
  projectsCreated: Project[];

  @OneToMany('ProjectMember', (member: ProjectMember) => member.user)
  projectMemberships: ProjectMember[];

  @OneToMany('DiagramVersion', (version: DiagramVersion) => version.creator)
  diagramVersions: DiagramVersion[];

  @OneToMany('AiAssistantLog', (log: AiAssistantLog) => log.user)
  aiLogs: AiAssistantLog[];

  @OneToMany('SessionParticipant', (participant: SessionParticipant) => participant.user)
  sessionParticipations: SessionParticipant[];
}
