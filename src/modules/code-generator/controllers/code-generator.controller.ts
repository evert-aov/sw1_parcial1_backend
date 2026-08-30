import {
  Controller,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { CodeGeneratorService } from '../services/code-generator.service';
import { GenerateCodeRequestDto } from '../dtos/generate-code-request.dto';
import { CodeGenerationPreviewResponseDto } from '../dtos/code-generation-preview-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../auth/entities/user.entity';

@ApiTags('code-generator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('codegen')
export class CodeGeneratorController {
  constructor(private readonly codegenService: CodeGeneratorService) {}

  @Post('preview/:diagramId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar vista previa del código Spring Boot 4 + Flyway a partir del ID del diagrama' })
  @ApiResponse({
    status: 200,
    description: 'Estructura de archivos y código generado para todas las capas',
    type: CodeGenerationPreviewResponseDto,
  })
  async previewFromDiagramId(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @Body() dto: GenerateCodeRequestDto,
    @CurrentUser() user: User,
  ): Promise<CodeGenerationPreviewResponseDto> {
    return this.codegenService.previewFromDiagramId(diagramId, dto, user.id);
  }

  @Post('preview-ast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar vista previa del código Spring Boot a partir del AST JSON en memoria (tiempo real)' })
  @ApiResponse({
    status: 200,
    description: 'Estructura de archivos y código generado en caliente',
    type: CodeGenerationPreviewResponseDto,
  })
  async previewFromAst(
    @Body() dto: GenerateCodeRequestDto,
  ): Promise<CodeGenerationPreviewResponseDto> {
    return this.codegenService.previewFromAst(dto);
  }

  @Post('download/:diagramId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compilar y descargar el proyecto Spring Boot completo en un archivo .zip' })
  @ApiProduces('application/zip')
  @ApiResponse({
    status: 200,
    description: 'Archivo ZIP con la solución Spring Boot completa, Dockerfile, docker-compose.yml y Flyway',
  })
  async downloadZipFromDiagramId(
    @Param('diagramId', ParseUUIDPipe) diagramId: string,
    @Body() dto: GenerateCodeRequestDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.codegenService.downloadZipFromDiagramId(diagramId, dto, user.id);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('download-ast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compilar y descargar el proyecto Spring Boot a partir del AST JSON directo en .zip' })
  @ApiProduces('application/zip')
  @ApiResponse({
    status: 200,
    description: 'Archivo ZIP generado en memoria con la arquitectura completa',
  })
  async downloadZipFromAst(
    @Body() dto: GenerateCodeRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.codegenService.downloadZipFromAst(dto);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
