import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from '../services/project.service';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';
import { AddMemberDto } from '../dtos/add-member.dto';
import { UpdateMemberRoleDto } from '../dtos/update-member-role.dto';
import { ProjectResponseDto } from '../dtos/project-response.dto';
import { ProjectMemberResponseDto } from '../dtos/project-member-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../auth/entities/user.entity';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo proyecto de modelado' })
  @ApiResponse({ status: 201, description: 'Proyecto creado exitosamente', type: ProjectResponseDto })
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    return this.projectService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los proyectos del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de proyectos', type: [ProjectResponseDto] })
  async findAll(@CurrentUser() user: User): Promise<ProjectResponseDto[]> {
    return this.projectService.findAllForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un proyecto por ID' })
  @ApiResponse({ status: 200, description: 'Detalle del proyecto', type: ProjectResponseDto })
  @ApiResponse({ status: 403, description: 'No tienes permisos para acceder a este proyecto' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    return this.projectService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar configuración o información de un proyecto' })
  @ApiResponse({ status: 200, description: 'Proyecto actualizado', type: ProjectResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    return this.projectService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un proyecto permanentemente (solo OWNER)' })
  @ApiResponse({ status: 200, description: 'Proyecto eliminado exitosamente' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ success: boolean; message: string }> {
    return this.projectService.remove(id, user.id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Listar los miembros colaboradores de un proyecto' })
  @ApiResponse({ status: 200, description: 'Lista de miembros', type: [ProjectMemberResponseDto] })
  async getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ProjectMemberResponseDto[]> {
    return this.projectService.getProjectMembers(id, user.id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invitar/agregar un miembro colaborador al proyecto por correo' })
  @ApiResponse({ status: 201, description: 'Miembro agregado exitosamente', type: ProjectMemberResponseDto })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectService.addMember(id, dto, user.id);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Actualizar el rol de un miembro colaborador' })
  @ApiResponse({ status: 200, description: 'Rol actualizado exitosamente', type: ProjectMemberResponseDto })
  async updateMemberRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: User,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectService.updateMemberRole(id, userId, dto, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remover un miembro del proyecto o abandonar el proyecto' })
  @ApiResponse({ status: 200, description: 'Miembro removido exitosamente' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ): Promise<{ success: boolean; message: string }> {
    return this.projectService.removeMember(id, userId, user.id);
  }
}
