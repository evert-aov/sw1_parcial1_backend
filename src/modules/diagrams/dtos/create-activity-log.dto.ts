import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateActivityLogDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  actor?: string;

  @IsString()
  @IsOptional()
  badgeClass?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
