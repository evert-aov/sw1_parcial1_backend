import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectRepository } from '../repositories/project.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';
import { AddMemberDto } from '../dtos/add-member.dto';
import { UpdateMemberRoleDto } from '../dtos/update-member-role.dto';
import { ProjectResponseDto } from '../dtos/project-response.dto';
import { ProjectMemberResponseDto } from '../dtos/project-member-response.dto';
import { ProjectRole } from '../entities/project-role.enum';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(dto: CreateProjectDto, userId: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepository.createProject(dto, userId);
    return ProjectResponseDto.fromEntity(project, userId);
  }

  async findAllForUser(userId: string): Promise<ProjectResponseDto[]> {
    const projects = await this.projectRepository.findAllForUser(userId);
    return projects.map((p) => ProjectResponseDto.fromEntity(p, userId));
  }

  async findOne(id: string, userId: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const role = await this.projectRepository.getMemberRole(id, userId);
    if (!role && project.createdBy !== userId) {
      throw new ForbiddenException('No tienes permisos para acceder a este proyecto');
    }

    return ProjectResponseDto.fromEntity(project, userId);
  }

  async update(id: string, dto: UpdateProjectDto, userId: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const role = await this.projectRepository.getMemberRole(id, userId);
    if (!role || (role !== ProjectRole.OWNER && role !== ProjectRole.EDITOR)) {
      throw new ForbiddenException('Solo los propietarios o editores pueden modificar el proyecto');
    }

    const updated = await this.projectRepository.updateProject(id, dto);
    return ProjectResponseDto.fromEntity(updated, userId);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const role = await this.projectRepository.getMemberRole(id, userId);
    if (role !== ProjectRole.OWNER && project.createdBy !== userId) {
      throw new ForbiddenException('Solo el propietario puede eliminar el proyecto');
    }

    await this.projectRepository.deleteProject(id);
    return { success: true, message: 'Proyecto eliminado exitosamente' };
  }

  async getProjectMembers(projectId: string, userId: string): Promise<ProjectMemberResponseDto[]> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const role = await this.projectRepository.getMemberRole(projectId, userId);
    if (!role && project.createdBy !== userId) {
      throw new ForbiddenException('No tienes acceso a los miembros de este proyecto');
    }

    const members = await this.projectRepository.getProjectMembers(projectId);
    return members.map((m) => ProjectMemberResponseDto.fromEntity(m));
  }

  async addMember(projectId: string, dto: AddMemberDto, currentUserId: string): Promise<ProjectMemberResponseDto> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const currentRole = await this.projectRepository.getMemberRole(projectId, currentUserId);
    if (currentRole !== ProjectRole.OWNER && project.createdBy !== currentUserId) {
      throw new ForbiddenException('Solo el propietario puede agregar miembros al proyecto');
    }

    const targetUser = await this.userRepository.findByEmail(dto.email.trim().toLowerCase());
    if (!targetUser) {
      throw new NotFoundException(`No se encontró ningún usuario con el correo: ${dto.email}`);
    }

    const existingMember = await this.projectRepository.findMember(projectId, targetUser.id);
    if (existingMember) {
      throw new ConflictException('El usuario ya es miembro de este proyecto');
    }

    const newMember = await this.projectRepository.addMember(
      projectId,
      targetUser.id,
      dto.role || ProjectRole.EDITOR,
    );

    newMember.user = targetUser;
    return ProjectMemberResponseDto.fromEntity(newMember);
  }

  async updateMemberRole(
    projectId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    currentUserId: string,
  ): Promise<ProjectMemberResponseDto> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const currentRole = await this.projectRepository.getMemberRole(projectId, currentUserId);
    if (currentRole !== ProjectRole.OWNER && project.createdBy !== currentUserId) {
      throw new ForbiddenException('Solo el propietario puede cambiar los roles de los miembros');
    }

    if (project.createdBy === targetUserId) {
      throw new BadRequestException('No puedes cambiar el rol del creador principal del proyecto');
    }

    const member = await this.projectRepository.findMember(projectId, targetUserId);
    if (!member) {
      throw new NotFoundException('El usuario no es miembro de este proyecto');
    }

    const updated = await this.projectRepository.updateMemberRole(projectId, targetUserId, dto.role);
    return ProjectMemberResponseDto.fromEntity(updated);
  }

  async removeMember(
    projectId: string,
    targetUserId: string,
    currentUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const currentRole = await this.projectRepository.getMemberRole(projectId, currentUserId);
    const isOwner = currentRole === ProjectRole.OWNER || project.createdBy === currentUserId;
    const isSelf = targetUserId === currentUserId;

    if (!isOwner && !isSelf) {
      throw new ForbiddenException('No tienes permisos para remover a este miembro');
    }

    if (project.createdBy === targetUserId) {
      throw new BadRequestException('El creador principal no puede abandonar el proyecto');
    }

    const member = await this.projectRepository.findMember(projectId, targetUserId);
    if (!member) {
      throw new NotFoundException('El usuario no es miembro de este proyecto');
    }

    await this.projectRepository.removeMember(projectId, targetUserId);
    return { success: true, message: 'Miembro removido exitosamente' };
  }
}
