import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { XmiExporterService, DiagramAstData } from './xmi-exporter.service';
import { XmiParserService } from './xmi-parser.service';
import { DiagramVersionRepository } from '../repositories/diagram-version.repository';
import { DiagramRepository } from '../../diagrams/repositories/diagram.repository';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import {
  ImportXmiDto,
  ExportAstToXmiDto,
  CreateDiagramVersionDto,
  DiagramVersionResponseDto,
} from '../dtos/xmi-interop.dto';

@Injectable()
export class XmiInteropService {
  constructor(
    private readonly exporterService: XmiExporterService,
    private readonly parserService: XmiParserService,
    private readonly versionRepo: DiagramVersionRepository,
    private readonly diagramRepo: DiagramRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  /**
   * Exporta un diagrama existente en la base de datos a formato XMI 2.1 estándar de Enterprise Architect.
   */
  async exportDiagramToXmi(diagramId: string, userId: string): Promise<{ filename: string; xmiContent: string }> {
    const diagram = await this.diagramRepo.findById(diagramId);
    if (!diagram) {
      throw new NotFoundException(`Diagrama con ID ${diagramId} no encontrado.`);
    }

    if (diagram.projectId) {
      await this.validateProjectAccess(diagram.projectId, userId);
    }

    const astData: DiagramAstData = {
      name: diagram.name,
      defaultLineStyle: diagram.defaultLineStyle || 'segment',
      nodes: (diagram.nodes || []).map(n => ({
        id: n.id,
        name: n.name,
        position: { x: Number(n.positionX), y: Number(n.positionY) },
        width: n.width || 220,
        height: n.height || 120,
        attributes: (n.attributes || []).map(a => ({
          name: a.name,
          type: a.type,
          visibility: a.visibility,
          isPk: a.isPk,
          isNullable: a.isNullable,
        })),
        methods: (n.methods || []).map(m => ({
          name: m.name,
          returnType: m.returnType,
          parameters: m.parameters || '',
          visibility: m.visibility,
        })),
        isAnchor: n.isAnchor,
        assocMainConnId: n.assocMainConnId || undefined,
      })),
      connections: (diagram.connections || []).map(c => ({
        id: c.id,
        sourceNodeId: c.sourceNodeId,
        targetNodeId: c.targetNodeId,
        sourceId: c.sourceId,
        targetId: c.targetId,
        type: c.type,
        name: c.name || undefined,
        sourceMultiplicity: c.sourceMultiplicity || '',
        targetMultiplicity: c.targetMultiplicity || '',
        lineStyle: c.lineStyle,
        assocAnchorNodeId: c.assocAnchorNodeId || undefined,
      })),
    };

    const xmiContent = this.exporterService.exportToXmi(astData);
    const filename = `${diagram.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_ea.xmi`;

    return { filename, xmiContent };
  }

  /**
   * Exporta directamente un AST provisto en el request body sin requerir persistencia previa.
   */
  exportAstToXmi(dto: ExportAstToXmiDto): { filename: string; xmiContent: string } {
    const xmiContent = this.exporterService.exportToXmi({
      name: dto.diagramName,
      nodes: dto.nodes || [],
      connections: dto.connections || [],
      defaultLineStyle: dto.defaultLineStyle || 'segment',
    });
    const filename = `${dto.diagramName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_ea.xmi`;
    return { filename, xmiContent };
  }

  /**
   * Parsea un archivo XMI 2.1 e inserta/actualiza el diagrama en BD si se solicitó.
   */
  async importXmi(dto: ImportXmiDto, userId: string): Promise<DiagramAstData & { diagramId?: string }> {
    const ast = this.parserService.parseXmi(dto.xmiContent);

    // Si se solicitó actualizar un diagrama existente
    if (dto.diagramId) {
      const diagram = await this.diagramRepo.findById(dto.diagramId);
      if (!diagram) {
        throw new NotFoundException(`Diagrama ${dto.diagramId} no encontrado para importar.`);
      }
      if (diagram.projectId) {
        await this.validateProjectAccess(diagram.projectId, userId, [ProjectRole.OWNER, ProjectRole.EDITOR]);
      }

      await this.diagramRepo.saveAst(dto.diagramId, {
        name: dto.diagramName || ast.name || diagram.name,
        defaultLineStyle: ast.defaultLineStyle || 'segment',
        nodes: ast.nodes.map(n => ({
          id: n.id,
          name: n.name,
          position: n.position,
          width: n.width,
          height: n.height,
          attributes: n.attributes || [],
          methods: n.methods || [],
          isAnchor: n.isAnchor,
          assocMainConnId: n.assocMainConnId,
        })),
        connections: ast.connections.map(c => ({
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
      });

      return { ...ast, diagramId: dto.diagramId };
    }

    // Si se solicitó crear un nuevo diagrama en un proyecto
    if (dto.projectId) {
      await this.validateProjectAccess(dto.projectId, userId, [ProjectRole.OWNER, ProjectRole.EDITOR]);

      const created = await this.diagramRepo.createDiagram({
        projectId: dto.projectId,
        name: dto.diagramName || ast.name || 'Diagrama Importado XMI',
        defaultLineStyle: ast.defaultLineStyle || 'segment',
      });

      await this.diagramRepo.saveAst(created.id, {
        name: created.name,
        defaultLineStyle: ast.defaultLineStyle || 'segment',
        nodes: ast.nodes.map(n => ({
          id: n.id,
          name: n.name,
          position: n.position,
          width: n.width,
          height: n.height,
          attributes: n.attributes || [],
          methods: n.methods || [],
          isAnchor: n.isAnchor,
          assocMainConnId: n.assocMainConnId,
        })),
        connections: ast.connections.map(c => ({
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
      });

      return { ...ast, diagramId: created.id };
    }

    return ast;
  }

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

    const version = await this.versionRepo.createVersion({
      diagramId,
      versionTag: dto.versionTag.trim(),
      astJson: astToSave,
      xmiContent,
      createdBy: userId,
    });

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
    await this.diagramRepo.saveAst(diagramId, {
      name: ast.name || version.diagram.name,
      defaultLineStyle: ast.defaultLineStyle || 'segment',
      nodes: (ast.nodes || []).map(n => ({
        id: n.id,
        name: n.name,
        position: n.position,
        width: n.width,
        height: n.height,
        attributes: n.attributes || [],
        methods: n.methods || [],
        isAnchor: n.isAnchor,
        assocMainConnId: n.assocMainConnId,
      })),
      connections: (ast.connections || []).map(c => ({
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
    });

    return ast;
  }

  private async validateProjectAccess(
    projectId: string,
    userId: string,
    allowedRoles: ProjectRole[] = [ProjectRole.OWNER, ProjectRole.EDITOR, ProjectRole.VIEWER],
  ): Promise<void> {
    const member = await this.projectRepo.findMember(projectId, userId);
    if (!member) {
      throw new ForbiddenException('No tienes acceso a este proyecto.');
    }
    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('No tienes los permisos requeridos para esta acción.');
    }
  }
}
