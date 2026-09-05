import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { DiagramVersion } from '../entities/diagram-version.entity';

@Injectable()
export class DiagramVersionRepository {
  constructor(
    @InjectRepository(DiagramVersion)
    private readonly repo: Repository<DiagramVersion>,
  ) {}

  create(data: DeepPartial<DiagramVersion>): DiagramVersion {
    return this.repo.create(data);
  }

  async save(version: DiagramVersion): Promise<DiagramVersion> {
    return this.repo.save(version);
  }

  async findByDiagramId(diagramId: string): Promise<DiagramVersion[]> {
    return this.repo.find({
      where: { diagramId },
      relations: { creator: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<DiagramVersion | null> {
    return this.repo.findOne({
      where: { id },
      relations: { creator: true, diagram: true },
    });
  }

  async findByDiagramAndTag(diagramId: string, versionTag: string): Promise<DiagramVersion | null> {
    return this.repo.findOne({
      where: { diagramId, versionTag },
      relations: { creator: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
