import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DiagramRepository } from '../repositories/diagram.repository';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { CreateDiagramDto } from '../dtos/create-diagram.dto';
import { UpdateDiagramDto } from '../dtos/update-diagram.dto';
import { SaveDiagramAstDto } from '../dtos/save-diagram-ast.dto';
import { DiagramResponseDto } from '../dtos/diagram-response.dto';
import { ProjectRole } from '../../projects/entities/project-role.enum';

@Injectable()
export class DiagramService {
  constructor(
    private readonly diagramRepository: DiagramRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

  private async checkProjectAccess(projectId: string, userId: string, requireWrite = false): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('El proyecto asociado no existe');
    }

    const role = await this.projectRepository.getMemberRole(projectId, userId);
    const isOwnerOrCreator = role === ProjectRole.OWNER || project.createdBy === userId;
    const isEditor = role === ProjectRole.EDITOR;

    if (!role && !isOwnerOrCreator) {
      throw new ForbiddenException('No tienes acceso a este proyecto ni a sus diagramas');
    }

    if (requireWrite && !isOwnerOrCreator && !isEditor) {
      throw new ForbiddenException('Solo los editores y propietarios pueden modificar diagramas');
    }
  }

  async create(dto: CreateDiagramDto, userId: string): Promise<DiagramResponseDto> {
    await this.checkProjectAccess(dto.projectId, userId, true);
    const diagram = await this.diagramRepository.createDiagram(dto);
    const fullDiagram = await this.diagramRepository.findById(diagram.id);
    return DiagramResponseDto.fromEntity(fullDiagram!);
  }

  async findAllByProjectId(projectId: string, userId: string): Promise<DiagramResponseDto[]> {
    await this.checkProjectAccess(projectId, userId, false);
    const diagrams = await this.diagramRepository.findAllByProjectId(projectId);
    return diagrams.map((d) => DiagramResponseDto.fromEntity(d));
  }

  async findOne(id: string, userId: string): Promise<DiagramResponseDto> {
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) {
      throw new NotFoundException('Diagrama no encontrado');
    }

    if (diagram.projectId) {
      await this.checkProjectAccess(diagram.projectId, userId, false);
    }

    return DiagramResponseDto.fromEntity(diagram);
  }

  async update(id: string, dto: UpdateDiagramDto, userId: string): Promise<DiagramResponseDto> {
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) {
      throw new NotFoundException('Diagrama no encontrado');
    }

    if (diagram.projectId) {
      await this.checkProjectAccess(diagram.projectId, userId, true);
    }

    const updated = await this.diagramRepository.updateDiagram(id, dto);
    return DiagramResponseDto.fromEntity(updated);
  }

  async saveAst(id: string, astDto: SaveDiagramAstDto, userId: string): Promise<DiagramResponseDto> {
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) {
      throw new NotFoundException('Diagrama no encontrado');
    }

    if (diagram.projectId) {
      await this.checkProjectAccess(diagram.projectId, userId, true);
    }

    const saved = await this.diagramRepository.saveAst(id, astDto);
    return DiagramResponseDto.fromEntity(saved);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const diagram = await this.diagramRepository.findById(id);
    if (!diagram) {
      throw new NotFoundException('Diagrama no encontrado');
    }

    if (diagram.projectId) {
      await this.checkProjectAccess(diagram.projectId, userId, true);
    }

    await this.diagramRepository.deleteDiagram(id);
    return { success: true, message: 'Diagrama eliminado exitosamente' };
  }
}
