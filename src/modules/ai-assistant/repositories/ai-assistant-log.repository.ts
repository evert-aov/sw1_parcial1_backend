import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { AiAssistantLog } from '../entities/ai-assistant-log.entity';

@Injectable()
export class AiAssistantLogRepository {
  constructor(
    @InjectRepository(AiAssistantLog)
    private readonly repo: Repository<AiAssistantLog>,
  ) {}

  create(data: DeepPartial<AiAssistantLog>): AiAssistantLog {
    return this.repo.create(data);
  }

  async save(log: AiAssistantLog): Promise<AiAssistantLog> {
    return this.repo.save(log);
  }

  async findById(id: string): Promise<AiAssistantLog | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        diagram: true,
        user: true,
      },
    });
  }

  async findByDiagramId(diagramId: string, limit = 50): Promise<AiAssistantLog[]> {
    return this.repo.find({
      where: { diagramId },
      order: { executedAt: 'DESC' },
      take: limit,
      relations: {
        user: true,
      },
    });
  }

  async findByUserId(userId: string, limit = 50): Promise<AiAssistantLog[]> {
    return this.repo.find({
      where: { userId },
      order: { executedAt: 'DESC' },
      take: limit,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async deleteByDiagramId(diagramId: string): Promise<void> {
    await this.repo.delete({ diagramId });
  }
}
