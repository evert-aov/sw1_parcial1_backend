import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Diagram } from '../../diagrams/entities/diagram.entity';
import type { User } from '../../auth/entities/user.entity';

@Entity('ai_assistant_logs')
export class AiAssistantLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'diagram_id', type: 'uuid' })
  diagramId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_prompt', type: 'text' })
  userPrompt: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType: string;

  @Column({ name: 'mutation_payload', type: 'jsonb' })
  mutationPayload: Record<string, any>;

  @Column({ name: 'tokens_used', type: 'int', default: 0 })
  tokensUsed: number;

  @CreateDateColumn({ name: 'executed_at', type: 'timestamp' })
  executedAt: Date;

  @ManyToOne('Diagram', (diagram: Diagram) => diagram.aiLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diagram_id' })
  diagram: Diagram;

  @ManyToOne('User', (user: User) => user.aiLogs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
