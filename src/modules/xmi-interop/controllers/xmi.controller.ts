import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../auth/interfaces/jwt-payload.interface';
import { XmiInteropService } from '../services/xmi-interop.service';
import {
  ImportXmiDto,
  ExportAstToXmiDto,
  CreateDiagramVersionDto,
  DiagramVersionResponseDto,
} from '../dtos/xmi-interop.dto';

@ApiTags('XMI Interoperability & Versioning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('xmi')
export class XmiController {
  constructor(private readonly xmiService: XmiInteropService) {}

  @Get('export/:diagramId')
  @ApiOperation({
    summary: 'Exportar diagrama existente a archivo XMI 2.1 (Enterprise Architect v17)',
    description:
      'Genera el documento XML estándar XMI 2.1 con metadatos completos y la sección gráfica de diagramas/geometría compatible con Enterprise Architect v17 y suites CASE.',
  })
  @ApiParam({ name: 'diagramId', description: 'UUID del diagrama a exportar' })
  @ApiResponse({ status: 200, description: 'Archivo XMI 2.1 generado exitosamente' })
  @ApiResponse({ status: 404, description: 'Diagrama no encontrado' })
  async exportDiagram(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @CurrentUser() user: UserPayload,
    @Res() res: Response,
  ) {
    const { filename, xmiContent } = await this.xmiService.exportDiagramToXmi(diagramId, user.id);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xmiContent);
  }

  @Post('export-ast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exportar AST en memoria a XMI 2.1 (Enterprise Architect v17)',
    description:
      'Recibe directamente el JSON del AST (nodos, coordenadas, relaciones) y devuelve el XML XMI 2.1 con su layout visual para descarga inmediata.',
  })
  @ApiResponse({ status: 200, description: 'Contenido XML XMI 2.1 generado' })
  exportAst(@Body() dto: ExportAstToXmiDto) {
    return this.xmiService.exportAstToXmi(dto);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Importar archivo XMI 2.1 (Enterprise Architect v17)',
    description:
      'Parsea el documento XML XMI 2.1 de Enterprise Architect, extrayendo clases, atributos, operaciones, relaciones y geometrías. Si se indica diagramId o projectId, persiste los cambios.',
  })
  @ApiResponse({ status: 200, description: 'AST del diagrama importado y parseado exitosamente' })
  @ApiResponse({ status: 400, description: 'Estructura XMI inválida o corrupta' })
  async importXmi(@Body() dto: ImportXmiDto, @CurrentUser() user: UserPayload) {
    return this.xmiService.importXmi(dto, user.id);
  }

  @Post('diagrams/:diagramId/versions')
  @ApiOperation({
    summary: 'Crear versión histórica / snapshot de un diagrama',
    description:
      'Congela el estado actual del AST y genera su correspondiente XMI 2.1 asociado a una etiqueta de versión (ej. v1.0.0).',
  })
  @ApiParam({ name: 'diagramId', description: 'UUID del diagrama' })
  @ApiResponse({ status: 201, type: DiagramVersionResponseDto, description: 'Versión creada' })
  async createVersion(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @Body() dto: CreateDiagramVersionDto,
    @CurrentUser() user: UserPayload,
  ): Promise<DiagramVersionResponseDto> {
    return this.xmiService.createDiagramVersion(diagramId, dto, user.id);
  }

  @Get('diagrams/:diagramId/versions')
  @ApiOperation({
    summary: 'Listar versiones históricas de un diagrama',
    description: 'Retorna el historial cronológico de versiones y snapshots de un diagrama.',
  })
  @ApiParam({ name: 'diagramId', description: 'UUID del diagrama' })
  @ApiResponse({ status: 200, type: [DiagramVersionResponseDto] })
  async getVersions(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @CurrentUser() user: UserPayload,
  ): Promise<DiagramVersionResponseDto[]> {
    return this.xmiService.getDiagramVersions(diagramId, user.id);
  }

  @Get('diagrams/:diagramId/versions/:versionId')
  @ApiOperation({
    summary: 'Obtener detalle de una versión histórica',
    description: 'Retorna el AST y el contenido XMI congelado en una versión específica.',
  })
  @ApiParam({ name: 'diagramId', description: 'UUID del diagrama' })
  @ApiParam({ name: 'versionId', description: 'UUID de la versión' })
  @ApiResponse({ status: 200, type: DiagramVersionResponseDto })
  async getVersionById(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: UserPayload,
  ): Promise<DiagramVersionResponseDto> {
    return this.xmiService.getDiagramVersionById(diagramId, versionId, user.id);
  }

  @Post('diagrams/:diagramId/versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restaurar diagrama al estado de una versión histórica',
    description: 'Sobrescribe el estado activo del diagrama con el AST de la versión indicada.',
  })
  @ApiParam({ name: 'diagramId', description: 'UUID del diagrama' })
  @ApiParam({ name: 'versionId', description: 'UUID de la versión a restaurar' })
  @ApiResponse({ status: 200, description: 'Diagrama restaurado exitosamente' })
  async restoreVersion(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.xmiService.restoreDiagramVersion(diagramId, versionId, user.id);
  }
}
