import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Diagram } from './diagram.entity';
import type { User } from '../../auth/entities/user.entity';

@Entity('diagram_activity_logs')
export class DiagramActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'diagram_id', type: 'uuid' })
  diagramId: string;

  @ManyToOne('Diagram', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagram_id' })
  diagram: Diagram;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 150, default: 'Usuario' })
  actor: string;

  @Column({ name: 'badge_class', type: 'varchar', length: 100, nullable: true })
  badgeClass: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
