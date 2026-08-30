import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DiagramRepository } from '../../diagrams/repositories/diagram.repository';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { SpringTemplateEngineService } from './spring-template-engine.service';
import { ZipArchiverService } from './zip-archiver.service';
import { GenerateCodeRequestDto } from '../dtos/generate-code-request.dto';
import { CodeGenerationPreviewResponseDto } from '../dtos/code-generation-preview-response.dto';

@Injectable()
export class CodeGeneratorService {
  constructor(
    private readonly diagramRepository: DiagramRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly templateEngine: SpringTemplateEngineService,
    private readonly zipArchiver: ZipArchiverService,
  ) {}

  private async checkProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('El proyecto asociado no existe');
    }

    const role = await this.projectRepository.getMemberRole(projectId, userId);
    const isOwnerOrCreator = role === ProjectRole.OWNER || project.createdBy === userId;

    if (!role && !isOwnerOrCreator) {
      throw new ForbiddenException('No tienes permisos para generar código en este proyecto');
    }
  }

  /**
   * Genera la vista previa de todos los archivos de código Spring Boot a partir de un diagrama persistido.
   */
  async previewFromDiagramId(
    diagramId: string,
    dto: GenerateCodeRequestDto,
    userId: string,
  ): Promise<CodeGenerationPreviewResponseDto> {
    const diagram = await this.diagramRepository.findById(diagramId);
    if (!diagram) {
      throw new NotFoundException('Diagrama no encontrado');
    }

    if (diagram.projectId) {
      await this.checkProjectAccess(diagram.projectId, userId);
    }

    const nodes = diagram.nodes || [];
    const connections = diagram.connections || [];

    const effectiveDto: GenerateCodeRequestDto = {
      ...dto,
      projectName: dto.projectName || diagram.name,
      artifactId: dto.artifactId || diagram.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    };

    const { context, files } = this.templateEngine.generateProjectFiles(effectiveDto, nodes, connections);

    return {
      projectName: context.projectName,
      totalFiles: files.length,
      files,
    };
  }

  /**
   * Genera la vista previa de archivos a partir de un payload AST directo (en caliente).
   */
  async previewFromAst(dto: GenerateCodeRequestDto): Promise<CodeGenerationPreviewResponseDto> {
    const nodes = dto.nodes || [];
    const connections = dto.connections || [];

    const { context, files } = this.templateEngine.generateProjectFiles(dto, nodes, connections);

    return {
      projectName: context.projectName,
      totalFiles: files.length,
      files,
    };
  }

  /**
   * Genera y empaqueta en un archivo ZIP descargable el proyecto Spring Boot a partir del ID del diagrama.
   */
  async downloadZipFromDiagramId(
    diagramId: string,
    dto: GenerateCodeRequestDto,
    userId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const preview = await this.previewFromDiagramId(diagramId, dto, userId);
    const rootDirName = dto.artifactId || 'spring-boot-uml-api';
    const zipBuffer = await this.zipArchiver.createZipBuffer(preview.files, rootDirName);

    return {
      filename: `${rootDirName}.zip`,
      buffer: zipBuffer,
    };
  }

  /**
   * Genera y empaqueta en un archivo ZIP descargable a partir de un payload AST directo.
   */
  async downloadZipFromAst(dto: GenerateCodeRequestDto): Promise<{ filename: string; buffer: Buffer }> {
    const preview = await this.previewFromAst(dto);
    const rootDirName = dto.artifactId || 'spring-boot-uml-api';
    const zipBuffer = await this.zipArchiver.createZipBuffer(preview.files, rootDirName);

    return {
      filename: `${rootDirName}.zip`,
      buffer: zipBuffer,
    };
  }
}
