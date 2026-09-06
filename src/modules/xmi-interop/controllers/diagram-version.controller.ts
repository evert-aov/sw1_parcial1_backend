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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { User } from '../../auth/entities/user.entity';
import { DiagramVersionService } from '../services/diagram-version.service';
import {
  CreateDiagramVersionDto,
  DiagramVersionResponseDto,
} from '../dtos/diagram-version.dto';

@ApiTags('Diagram Versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('xmi/diagrams/:diagramId/versions')
export class DiagramVersionController {
  constructor(private readonly versionService: DiagramVersionService) {}

  @Post()
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
    @CurrentUser() user: User,
  ): Promise<DiagramVersionResponseDto> {
    return this.versionService.createDiagramVersion(diagramId, dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar versiones históricas de un diagrama',
    description: 'Retorna el historial cronológico de versiones y snapshots de un diagrama.',
  })
  @ApiParam({ name: 'diagramId', description: 'UUID del diagrama' })
  @ApiResponse({ status: 200, type: [DiagramVersionResponseDto] })
  async getVersions(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @CurrentUser() user: User,
  ): Promise<DiagramVersionResponseDto[]> {
    return this.versionService.getDiagramVersions(diagramId, user.id);
  }

  @Get(':versionId')
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
    @CurrentUser() user: User,
  ): Promise<DiagramVersionResponseDto> {
    return this.versionService.getDiagramVersionById(diagramId, versionId, user.id);
  }

  @Post(':versionId/restore')
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
    @CurrentUser() user: User,
  ) {
    return this.versionService.restoreDiagramVersion(diagramId, versionId, user.id);
  }
}
