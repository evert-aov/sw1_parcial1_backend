import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { Diagram } from '../../diagrams/entities/diagram.entity';
import type { User } from '../../auth/entities/user.entity';

@Entity('diagram_versions')
@Unique(['diagramId', 'versionTag'])
export class DiagramVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'diagram_id', type: 'uuid' })
  diagramId: string;

  @Column({ name: 'version_tag', type: 'varchar', length: 50 })
  versionTag: string;

  @Column({ name: 'ast_json', type: 'jsonb' })
  astJson: Record<string, any>;

  @Column({ name: 'xmi_content', type: 'text', nullable: true })
  xmiContent: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne('Diagram', (diagram: Diagram) => diagram.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagram_id' })
  diagram: Diagram;

  @ManyToOne('User', (user: User) => user.diagramVersions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
