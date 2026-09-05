import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { DiagramActivityLog } from '../entities/diagram-activity-log.entity';

@Injectable()
export class DiagramActivityLogRepository {
  constructor(
    @InjectRepository(DiagramActivityLog)
    private readonly repo: Repository<DiagramActivityLog>,
  ) {}

  create(data: DeepPartial<DiagramActivityLog>): DiagramActivityLog {
    return this.repo.create(data);
  }

  async save(log: DiagramActivityLog): Promise<DiagramActivityLog> {
    return this.repo.save(log);
  }

  async findByDiagramId(diagramId: string, limit = 50): Promise<DiagramActivityLog[]> {
    return this.repo.find({
      where: { diagramId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async deleteByDiagramId(diagramId: string): Promise<void> {
    await this.repo.delete({ diagramId });
  }
}
