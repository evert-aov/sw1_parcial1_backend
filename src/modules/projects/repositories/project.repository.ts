import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectRole } from '../entities/project-role.enum';
import { Diagram } from '../../diagrams/entities/diagram.entity';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';

@Injectable()
export class ProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepo: Repository<ProjectMember>,
    @InjectRepository(Diagram)
    private readonly diagramRepo: Repository<Diagram>,
  ) {}

  async createProject(dto: CreateProjectDto, userId: string): Promise<Project> {
    const project = this.projectRepo.create({
      name: dto.name.trim(),
      description: dto.description?.trim(),
      basePackage: dto.basePackage || 'com.example.app',
      javaVersion: dto.javaVersion || 21,
      springBootVersion: dto.springBootVersion || '3.3.0',
      createdBy: userId,
    });

    const savedProject = await this.projectRepo.save(project);

    // Agregar creador como OWNER en project_members
    const ownerMember = this.memberRepo.create({
      projectId: savedProject.id,
      userId,
      role: ProjectRole.OWNER,
    });
    await this.memberRepo.save(ownerMember);

    // Crear un diagrama inicial por defecto dentro del proyecto
    const defaultDiagram = this.diagramRepo.create({
      projectId: savedProject.id,
      name: `${savedProject.name} - Diagrama Principal`,
      version: '1.0.0',
      defaultLineStyle: 'segment',
    });
    await this.diagramRepo.save(defaultDiagram);

    return this.findById(savedProject.id) as Promise<Project>;
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    return this.projectRepo
      .createQueryBuilder('project')
      .innerJoin('project.members', 'membership', 'membership.userId = :userId', { userId })
      .leftJoinAndSelect('project.creator', 'creator')
      .leftJoinAndSelect('project.members', 'allMembers')
      .leftJoinAndSelect('allMembers.user', 'memberUser')
      .leftJoinAndSelect('project.diagrams', 'diagrams')
      .orderBy('project.createdAt', 'DESC')
      .getMany();
  }

  async findById(id: string): Promise<Project | null> {
    return this.projectRepo.findOne({
      where: { id },
      relations: {
        creator: true,
        members: {
          user: true,
        },
        diagrams: true,
      },
    });
  }

  async getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await this.memberRepo.findOne({
      where: { projectId, userId },
    });
    return member ? member.role : null;
  }

  async updateProject(id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.projectRepo.update(id, {
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.basePackage && { basePackage: dto.basePackage }),
      ...(dto.javaVersion && { javaVersion: dto.javaVersion }),
      ...(dto.springBootVersion && { springBootVersion: dto.springBootVersion }),
    });
    return this.findById(id) as Promise<Project>;
  }

  async deleteProject(id: string): Promise<void> {
    await this.projectRepo.delete(id);
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.memberRepo.findOne({
      where: { projectId, userId },
      relations: {
        user: true,
      },
    });
  }

  async addMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
    const member = this.memberRepo.create({
      projectId,
      userId,
      role,
    });
    return this.memberRepo.save(member);
  }

  async updateMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
    await this.memberRepo.update({ projectId, userId }, { role });
    return this.findMember(projectId, userId) as Promise<ProjectMember>;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.memberRepo.delete({ projectId, userId });
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return this.memberRepo.find({
      where: { projectId },
      relations: {
        user: true,
      },
      order: { joinedAt: 'ASC' },
    });
  }
}
