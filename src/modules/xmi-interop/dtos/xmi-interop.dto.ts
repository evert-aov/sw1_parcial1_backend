import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportXmiDto {
  @ApiProperty({
    description: 'Contenido XML/XMI 2.1 estándar de Enterprise Architect u otra herramienta CASE',
    example: '<?xml version="1.0" encoding="windows-1252"?>\n<xmi:XMI xmi:version="2.1" ...>...</xmi:XMI>',
  })
  @IsString()
  @IsNotEmpty({ message: 'El contenido XMI no puede estar vacío.' })
  xmiContent: string;

  @ApiPropertyOptional({
    description: 'ID del diagrama existente a actualizar en base de datos (opcional)',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El diagramId debe ser un UUID v4 válido.' })
  diagramId?: string;

  @ApiPropertyOptional({
    description: 'ID del proyecto donde crear un nuevo diagrama (si no se provee diagramId)',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El projectId debe ser un UUID v4 válido.' })
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Nombre asignado al diagrama importado',
    example: 'Diagrama Importado desde Enterprise Architect',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  diagramName?: string;
}

export class ExportAstToXmiDto {
  @ApiProperty({
    description: 'Nombre del diagrama a exportar',
    example: 'Modelo de Clases E-Commerce',
  })
  @IsString()
  @IsNotEmpty()
  diagramName: string;

  @ApiProperty({
    description: 'Lista de nodos/clases UML con atributos, métodos y coordenadas (x, y, width, height)',
  })
  @IsArray()
  @IsOptional()
  nodes?: any[];

  @ApiProperty({
    description: 'Lista de conexiones y relaciones UML con multiplicidades y estilos',
  })
  @IsArray()
  @IsOptional()
  connections?: any[];

  @ApiPropertyOptional({
    description: 'Estilo de línea por defecto (segment, straight, bezier, adaptive-curve)',
    example: 'segment',
  })
  @IsOptional()
  @IsString()
  defaultLineStyle?: string;
}


