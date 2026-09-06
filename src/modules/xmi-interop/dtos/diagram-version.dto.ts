import { IsString, IsNotEmpty, IsOptional, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiagramVersionDto {
  @ApiProperty({
    description: 'Etiqueta o tag semántico de la versión',
    example: 'v1.0.0',
  })
  @IsString()
  @IsNotEmpty({ message: 'La etiqueta de versión es obligatoria.' })
  @MaxLength(50)
  versionTag: string;

  @ApiPropertyOptional({
    description: 'AST JSON opcional a congelar (si se omite, se utiliza el estado actual del diagrama)',
  })
  @IsOptional()
  @IsObject()
  astJson?: Record<string, any>;
}

export class DiagramVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  diagramId: string;

  @ApiProperty()
  versionTag: string;

  @ApiProperty()
  astJson: Record<string, any>;

  @ApiPropertyOptional()
  xmiContent?: string | null;

  @ApiProperty()
  createdBy: string;

  @ApiPropertyOptional()
  creatorName?: string;

  @ApiProperty()
  createdAt: Date;
}
