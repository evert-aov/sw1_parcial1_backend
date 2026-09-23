import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class AiAudioPromptDto {
  @ApiProperty({
    description: 'Audio codificado en Base64 con la instrucción o requerimiento por voz del usuario',
    example: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8...',
  })
  @IsString()
  @IsNotEmpty()
  audioBase64: string;

  @ApiProperty({
    description: 'Tipo MIME del archivo de audio (ej: audio/webm, audio/mp4, audio/wav, audio/ogg, audio/mp3)',
    example: 'audio/webm',
    default: 'audio/webm',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'Instrucción o texto complementario opcional que acompaña al audio',
    required: false,
    example: 'Aplica las modificaciones dictadas en el audio al diagrama actual',
  })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiProperty({
    description: 'Identificador del diagrama actual',
    example: 'd9b736b4-2b62-4217-a068-d0a5180f9702',
  })
  @IsString()
  @IsNotEmpty()
  diagramId: string;

  @ApiProperty({
    description: 'Código de sala de colaboración opcional',
    required: false,
    example: 'ROOM-FAC123',
  })
  @IsOptional()
  @IsString()
  roomCode?: string;

  @ApiProperty({
    description: 'Lista actual de nodos del diagrama para contexto y mutación',
    type: [Object],
    required: false,
  })
  @IsOptional()
  @IsArray()
  currentNodes?: any[];

  @ApiProperty({
    description: 'Lista actual de conexiones del diagrama para contexto y mutación',
    type: [Object],
    required: false,
  })
  @IsOptional()
  @IsArray()
  currentConnections?: any[];

  @ApiProperty({
    description: 'Historial de actividades de la sesión para contexto ampliado',
    type: [Object],
    required: false,
  })
  @IsOptional()
  @IsArray()
  sessionHistory?: any[];

  @ApiProperty({
    description: 'Proveedor de IA a utilizar (por defecto vertex con Gemini para soporte multimodal de audio)',
    required: false,
    example: 'vertex',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    description: 'Modelo específico de IA a utilizar',
    required: false,
    example: 'gemini-2.5-flash',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
