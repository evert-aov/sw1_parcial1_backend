import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DiagramVersionRepository } from '../repositories/diagram-version.repository';
import { DiagramRepository } from '../../diagrams/repositories/diagram.repository';
import { DiagramService } from '../../diagrams/services/diagram.service';
import { XmiExporterService, DiagramAstData } from './xmi-exporter.service';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { ProjectMemberRepository } from '../../projects/repositories/project-member.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { CreateDiagramVersionDto, DiagramVersionResponseDto } from '../dtos/diagram-version.dto';

@Injectable()
export class DiagramVersionService {
  constructor(
    private readonly versionRepo: DiagramVersionRepository,
    private readonly diagramRepo: DiagramRepository,
    private readonly diagramService: DiagramService,
    private readonly exporterService: XmiExporterService,
    private readonly projectRepo: ProjectRepository,
    private readonly projectMemberRepo: ProjectMemberRepository,
  ) {}

  /**
   * Crea una versión/snapshot congelado del diagrama con su AST y XMI generado.
   */
  async createDiagramVersion(
    diagramId: string,
    dto: CreateDiagramVersionDto,
    userId: string,
  ): Promise<DiagramVersionResponseDto> {
    const diagram = await this.diagramRepo.findById(diagramId);
    if (!diagram) {
      throw new NotFoundException(`Diagrama ${diagramId} no encontrado.`);
    }
    if (diagram.projectId) {
      await this.validateProjectAccess(diagram.projectId, userId, [ProjectRole.OWNER, ProjectRole.EDITOR]);
    }

    let astToSave = dto.astJson;
    if (!astToSave) {
      astToSave = {
        name: diagram.name,
        defaultLineStyle: diagram.defaultLineStyle,
        nodes: (diagram.nodes || []).map(n => ({
          id: n.id,
          name: n.name,
          position: { x: Number(n.positionX), y: Number(n.positionY) },
          width: n.width,
          height: n.height,
          attributes: n.attributes,
          methods: n.methods,
          isAnchor: n.isAnchor,
          assocMainConnId: n.assocMainConnId,
        })),
        connections: (diagram.connections || []).map(c => ({
          id: c.id,
          sourceNodeId: c.sourceNodeId,
          targetNodeId: c.targetNodeId,
          sourceId: c.sourceId,
          targetId: c.targetId,
          type: c.type,
          name: c.name,
          sourceMultiplicity: c.sourceMultiplicity,
          targetMultiplicity: c.targetMultiplicity,
          lineStyle: c.lineStyle,
          assocAnchorNodeId: c.assocAnchorNodeId,
        })),
      };
    }

    const xmiContent = this.exporterService.exportToXmi(astToSave as DiagramAstData);
    const versionTag = dto.versionTag.trim();

    let version = await this.versionRepo.findByDiagramAndTag(diagramId, versionTag);
    if (version) {
      version.astJson = astToSave;
      version.xmiContent = xmiContent;
      version.createdBy = userId;
    } else {
      version = this.versionRepo.create({
        diagramId,
        versionTag,
        astJson: astToSave,
        xmiContent,
        createdBy: userId,
      });
    }

    const savedVersion = await this.versionRepo.save(version);

    return {
      id: savedVersion.id,
      diagramId: savedVersion.diagramId,
      versionTag: savedVersion.versionTag,
      astJson: savedVersion.astJson,
      xmiContent: savedVersion.xmiContent,
      createdBy: savedVersion.createdBy,
      creatorName: savedVersion.creator?.fullName,
      createdAt: savedVersion.createdAt,
    };
  }

  /**
   * Lista todas las versiones históricas de un diagrama.
   */
  async getDiagramVersions(diagramId: string, userId: string): Promise<DiagramVersionResponseDto[]> {
    const diagram = await this.diagramRepo.findById(diagramId);
    if (!diagram) {
      throw new NotFoundException(`Diagrama ${diagramId} no encontrado.`);
    }
    if (diagram.projectId) {
      await this.validateProjectAccess(diagram.projectId, userId);
    }

    const versions = await this.versionRepo.findByDiagramId(diagramId);
    return versions.map(v => ({
      id: v.id,
      diagramId: v.diagramId,
      versionTag: v.versionTag,
      astJson: v.astJson,
      xmiContent: v.xmiContent,
      createdBy: v.createdBy,
      creatorName: v.creator?.fullName,
      createdAt: v.createdAt,
    }));
  }

  /**
   * Obtiene una versión específica por su ID.
   */
  async getDiagramVersionById(
    diagramId: string,
    versionId: string,
    userId: string,
  ): Promise<DiagramVersionResponseDto> {
    const version = await this.versionRepo.findById(versionId);
    if (!version || version.diagramId !== diagramId) {
      throw new NotFoundException(`Versión ${versionId} no encontrada para el diagrama.`);
    }
    if (version.diagram?.projectId) {
      await this.validateProjectAccess(version.diagram.projectId, userId);
    }

    return {
      id: version.id,
      diagramId: version.diagramId,
      versionTag: version.versionTag,
      astJson: version.astJson,
      xmiContent: version.xmiContent,
      createdBy: version.createdBy,
      creatorName: version.creator?.fullName,
      createdAt: version.createdAt,
    };
  }

  /**
   * Restaura el estado del diagrama activo al AST de una versión histórica.
   */
  async restoreDiagramVersion(
    diagramId: string,
    versionId: string,
    userId: string,
  ): Promise<DiagramAstData> {
    const version = await this.versionRepo.findById(versionId);
    if (!version || version.diagramId !== diagramId) {
      throw new NotFoundException(`Versión ${versionId} no encontrada para el diagrama.`);
    }
    if (version.diagram?.projectId) {
      await this.validateProjectAccess(version.diagram.projectId, userId, [ProjectRole.OWNER, ProjectRole.EDITOR]);
    }

    const ast = version.astJson as DiagramAstData;
    if (ast.name) {
      await this.diagramRepo.update(diagramId, { name: ast.name });
    }
    await this.diagramService.saveAst(diagramId, {
      defaultLineStyle: ast.defaultLineStyle || 'segment',
      nodes: (ast.nodes || []).map(n => ({
        id: n.id,
        name: n.name,
        positionX: Number(n.position?.x ?? 50),
        positionY: Number(n.position?.y ?? 50),
        width: n.width || 220,
        height: n.height || 120,
        attributes: (n.attributes || []).map((a, i) => ({
          name: a.name,
          type: a.type,
          orderIndex: i,
        })),
        methods: (n.methods || []).map((m, i) => ({
          name: m.name,
          parameters: m.parameters || '',
          returnType: m.returnType || 'void',
          orderIndex: i,
        })),
        isAnchor: n.isAnchor || false,
        assocMainConnId: n.assocMainConnId || null,
      })),
      connections: (ast.connections || []).map(c => ({
        id: c.id,
        sourceNodeId: c.sourceNodeId,
        targetNodeId: c.targetNodeId,
        sourceId: c.sourceId || `${c.sourceNodeId}_right`,
        targetId: c.targetId || `${c.targetNodeId}_left`,
        type: c.type,
        name: c.name || null,
        sourceMultiplicity: c.sourceMultiplicity || '1',
        targetMultiplicity: c.targetMultiplicity || '0..*',
        lineStyle: c.lineStyle || 'segment',
        assocAnchorNodeId: c.assocAnchorNodeId || null,
      })),
    });

    return ast;
  }

  private async validateProjectAccess(
    projectId: string,
    userId: string,
    allowedRoles?: ProjectRole[],
  ): Promise<void> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Proyecto ${projectId} no encontrado.`);
    }

    if (project.createdBy === userId) {
      return;
    }

    const role = await this.projectMemberRepo.findRole(projectId, userId);
    if (!role) {
      throw new ForbiddenException('No tienes acceso al proyecto asociado a este diagrama.');
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Tu rol (${role}) no tiene permisos para realizar esta acción. Requerido: ${allowedRoles.join(', ')}`,
      );
    }
  }
}
