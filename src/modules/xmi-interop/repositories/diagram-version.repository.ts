import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagramVersion } from '../entities/diagram-version.entity';

@Injectable()
export class DiagramVersionRepository {
  constructor(
    @InjectRepository(DiagramVersion)
    private readonly versionRepo: Repository<DiagramVersion>,
  ) {}

  async createVersion(data: {
    diagramId: string;
    versionTag: string;
    astJson: Record<string, any>;
    xmiContent?: string | null;
    createdBy: string;
  }): Promise<DiagramVersion> {
    const existing = await this.versionRepo.findOne({
      where: { diagramId: data.diagramId, versionTag: data.versionTag },
    });

    if (existing) {
      existing.astJson = data.astJson;
      existing.xmiContent = data.xmiContent || null;
      existing.createdBy = data.createdBy;
      return this.versionRepo.save(existing);
    }

    const version = this.versionRepo.create({
      diagramId: data.diagramId,
      versionTag: data.versionTag,
      astJson: data.astJson,
      xmiContent: data.xmiContent || null,
      createdBy: data.createdBy,
    });
    return this.versionRepo.save(version);
  }

  async findByDiagramId(diagramId: string): Promise<DiagramVersion[]> {
    return this.versionRepo.find({
      where: { diagramId },
      relations: { creator: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<DiagramVersion | null> {
    return this.versionRepo.findOne({
      where: { id },
      relations: { creator: true, diagram: true },
    });
  }

  async findByDiagramAndTag(diagramId: string, versionTag: string): Promise<DiagramVersion | null> {
    return this.versionRepo.findOne({
      where: { diagramId, versionTag },
      relations: { creator: true },
    });
  }

  async deleteVersion(id: string): Promise<boolean> {
    const res = await this.versionRepo.delete(id);
    return (res.affected || 0) > 0;
  }
}
