import { IsString, IsOptional, IsArray, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateCodeRequestDto {
  @ApiPropertyOptional({ description: 'ID del diagrama persistido en base de datos', example: '11111111-2222-3333-4444-555555555555' })
  @IsOptional()
  @IsString()
  diagramId?: string;

  @ApiPropertyOptional({ description: 'Paquete base Java para la solución', default: 'com.app.studio', example: 'com.uagrm.ventas' })
  @IsOptional()
  @IsString()
  packageName?: string;

  @ApiPropertyOptional({ description: 'Artifact ID de Maven', default: 'spring-boot-uml-api', example: 'sistema-ventas-api' })
  @IsOptional()
  @IsString()
  artifactId?: string;

  @ApiPropertyOptional({ description: 'Group ID de Maven', default: 'com.app', example: 'com.uagrm' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ description: 'Nombre descriptivo del proyecto', default: 'Spring Boot UML Microservice' })
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional({ description: 'Versión de Java (17 o 21)', default: '21', example: '21' })
  @IsOptional()
  @IsString()
  javaVersion?: string;

  @ApiPropertyOptional({ description: 'Versión de Spring Boot', default: '3.4.0', example: '3.4.0' })
  @IsOptional()
  @IsString()
  springBootVersion?: string;

  @ApiPropertyOptional({ description: 'Nombre de la base de datos PostgreSQL', default: 'app_db' })
  @IsOptional()
  @IsString()
  databaseName?: string;

  @ApiPropertyOptional({ description: 'Usuario de la base de datos PostgreSQL', default: 'postgres' })
  @IsOptional()
  @IsString()
  databaseUser?: string;

  @ApiPropertyOptional({ description: 'Contraseña de la base de datos PostgreSQL', default: 'postgres' })
  @IsOptional()
  @IsString()
  databasePassword?: string;

  @ApiPropertyOptional({ description: 'Puerto del contenedor de base de datos', default: 5432 })
  @IsOptional()
  @IsNumber()
  databasePort?: number;

  @ApiPropertyOptional({ description: 'Puerto del servidor Spring Boot', default: 8080 })
  @IsOptional()
  @IsNumber()
  serverPort?: number;

  @ApiPropertyOptional({ description: 'Nodos de clases UML en memoria (opcional si no se pasa diagramId)' })
  @IsOptional()
  @IsArray()
  nodes?: any[];

  @ApiPropertyOptional({ description: 'Conexiones y relaciones UML en memoria (opcional si no se pasa diagramId)' })
  @IsOptional()
  @IsArray()
  connections?: any[];
}
