import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Diagram } from '../entities/diagram.entity';
import { UmlNode } from '../entities/uml-node.entity';
import { UmlAttribute } from '../entities/uml-attribute.entity';
import { UmlMethod } from '../entities/uml-method.entity';
import { UmlConnection } from '../entities/uml-connection.entity';
import { DiagramActivityLog } from '../entities/diagram-activity-log.entity';
import { CreateDiagramDto } from '../dtos/create-diagram.dto';
import { UpdateDiagramDto } from '../dtos/update-diagram.dto';
import { SaveDiagramAstDto } from '../dtos/save-diagram-ast.dto';
import { CreateActivityLogDto } from '../dtos/create-activity-log.dto';

@Injectable()
export class DiagramRepository {
  constructor(
    @InjectRepository(Diagram)
    private readonly diagramRepo: Repository<Diagram>,
    @InjectRepository(UmlNode)
    private readonly nodeRepo: Repository<UmlNode>,
    @InjectRepository(UmlConnection)
    private readonly connRepo: Repository<UmlConnection>,
    @InjectRepository(DiagramActivityLog)
    private readonly activityLogRepo: Repository<DiagramActivityLog>,
    private readonly dataSource: DataSource,
  ) {}

  async createDiagram(dto: CreateDiagramDto): Promise<Diagram> {
    const diagram = this.diagramRepo.create({
      projectId: dto.projectId,
      name: dto.name.trim(),
      version: dto.version || '1.0.0',
      defaultLineStyle: dto.defaultLineStyle || 'segment',
    });
    return this.diagramRepo.save(diagram);
  }

  async findAllByProjectId(projectId: string): Promise<Diagram[]> {
    return this.diagramRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Diagram | null> {
    return this.diagramRepo.findOne({
      where: { id },
      relations: {
        nodes: {
          attributes: true,
          methods: true,
        },
        connections: true,
        project: true,
      },
    });
  }

  async updateDiagram(id: string, dto: UpdateDiagramDto): Promise<Diagram> {
    await this.diagramRepo.update(id, {
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.version && { version: dto.version }),
      ...(dto.defaultLineStyle && { defaultLineStyle: dto.defaultLineStyle }),
    });
    return this.findById(id) as Promise<Diagram>;
  }

  async deleteDiagram(id: string): Promise<void> {
    await this.diagramRepo.delete(id);
  }

  async saveAst(diagramId: string, astDto: SaveDiagramAstDto): Promise<Diagram> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Limpiar conexiones y nodos existentes del diagrama
      await manager.delete(UmlConnection, { diagramId });
      
      const existingNodes = await manager.find(UmlNode, { where: { diagramId } });
      const nodeIds = existingNodes.map((n) => n.id);
      
      if (nodeIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(UmlAttribute)
          .where('node_id IN (:...nodeIds)', { nodeIds })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from(UmlMethod)
          .where('node_id IN (:...nodeIds)', { nodeIds })
          .execute();

        await manager.delete(UmlNode, { diagramId });
      }

      // 2. Insertar nodos nuevos con atributos y métodos
      for (const nodeDto of astDto.nodes) {
        const node = manager.create(UmlNode, {
          id: nodeDto.id,
          diagramId,
          name: nodeDto.name,
          positionX: nodeDto.positionX,
          positionY: nodeDto.positionY,
          width: nodeDto.width || 220,
          height: nodeDto.height || null,
          isAnchor: nodeDto.isAnchor || false,
          assocMainConnId: nodeDto.assocMainConnId || null,
        });
        await manager.save(node);

        if (nodeDto.attributes && nodeDto.attributes.length > 0) {
          const attributes = nodeDto.attributes.map((attr, index) =>
            manager.create(UmlAttribute, {
              nodeId: node.id,
              name: attr.name,
              type: attr.type,
              orderIndex: attr.orderIndex !== undefined ? attr.orderIndex : index,
            }),
          );
          await manager.save(attributes);
        }

        if (nodeDto.methods && nodeDto.methods.length > 0) {
          const methods = nodeDto.methods.map((method, index) =>
            manager.create(UmlMethod, {
              nodeId: node.id,
              name: method.name,
              parameters: method.parameters || '',
              returnType: method.returnType,
              orderIndex: method.orderIndex !== undefined ? method.orderIndex : index,
            }),
          );
          await manager.save(methods);
        }
      }

      // 3. Insertar conexiones nuevas
      if (astDto.connections && astDto.connections.length > 0) {
        const connections = astDto.connections.map((connDto) =>
          manager.create(UmlConnection, {
            id: connDto.id,
            diagramId,
            sourceNodeId: connDto.sourceNodeId,
            targetNodeId: connDto.targetNodeId,
            sourceId: connDto.sourceId,
            targetId: connDto.targetId,
            type: connDto.type,
            lineStyle: connDto.lineStyle || 'segment',
            name: connDto.name || null,
            sourceMultiplicity: connDto.sourceMultiplicity || '1',
            targetMultiplicity: connDto.targetMultiplicity || '0..*',
            assocAnchorNodeId: connDto.assocAnchorNodeId || null,
          }),
        );
        await manager.save(connections);
      }

      // 4. Actualizar fecha de modificación y estilo de línea por defecto
      await manager.update(Diagram, diagramId, {
        ...(astDto.defaultLineStyle && { defaultLineStyle: astDto.defaultLineStyle }),
        updatedAt: new Date(),
      });

      // 5. Retornar diagrama completo actualizado
      const updatedDiagram = await manager.findOne(Diagram, {
        where: { id: diagramId },
        relations: {
          nodes: {
            attributes: true,
            methods: true,
          },
          connections: true,
        },
      });

      return updatedDiagram!;
    });
  }

  async createActivityLog(diagramId: string, userId: string | null, dto: CreateActivityLogDto): Promise<DiagramActivityLog> {
    const log = this.activityLogRepo.create({
      diagramId,
      userId,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      actor: dto.actor || 'Usuario',
      badgeClass: dto.badgeClass || null,
      metadata: dto.metadata || null,
    });
    return this.activityLogRepo.save(log);
  }

  async findActivityLogs(diagramId: string, limit = 50): Promise<DiagramActivityLog[]> {
    return this.activityLogRepo.find({
      where: { diagramId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async clearActivityLogs(diagramId: string): Promise<void> {
    await this.activityLogRepo.delete({ diagramId });
  }
}
