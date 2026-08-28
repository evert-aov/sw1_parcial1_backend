import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectRepository } from '../repositories/project.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { ProjectRole } from '../entities/project-role.enum';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { User } from '../../auth/entities/user.entity';

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: jest.Mocked<Partial<ProjectRepository>>;
  let userRepo: jest.Mocked<Partial<UserRepository>>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockOtherUserId = '22222222-2222-2222-2222-222222222222';
  const mockProjectId = '33333333-3333-3333-3333-333333333333';

  const mockUser: User = {
    id: mockUserId,
    fullName: 'Evert Rodriguez',
    email: 'evert@uagrm.edu.bo',
    passwordHash: 'hash',
    isActive: true,
    createdAt: new Date(),
    projectsCreated: [],
    projectMemberships: [],
    diagramVersions: [],
    aiLogs: [],
    sessionParticipations: [],
  };

  const mockProject: Project = {
    id: mockProjectId,
    name: 'Test Project',
    description: 'A test project description',
    basePackage: 'com.test.app',
    javaVersion: 21,
    springBootVersion: '3.3.0',
    createdBy: mockUserId,
    createdAt: new Date(),
    creator: mockUser,
    members: [
      {
        id: 'mem-1',
        projectId: mockProjectId,
        userId: mockUserId,
        role: ProjectRole.OWNER,
        joinedAt: new Date(),
        project: {} as any,
        user: mockUser,
      },
    ],
    diagrams: [],
  };

  beforeEach(async () => {
    projectRepo = {
      createProject: jest.fn(),
      findAllForUser: jest.fn(),
      findById: jest.fn(),
      getMemberRole: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      findMember: jest.fn(),
      addMember: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      getProjectMembers: jest.fn(),
    };

    userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: projectRepo },
        { provide: UserRepository, useValue: userRepo },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe crear un nuevo proyecto exitosamente', async () => {
      projectRepo.createProject!.mockResolvedValue(mockProject);

      const result = await service.create(
        {
          name: 'Test Project',
          description: 'A test project description',
          basePackage: 'com.test.app',
          javaVersion: 21,
          springBootVersion: '3.3.0',
        },
        mockUserId,
      );

      expect(projectRepo.createProject).toHaveBeenCalled();
      expect(result).toHaveProperty('id', mockProjectId);
      expect(result).toHaveProperty('name', 'Test Project');
    });
  });

  describe('findAllForUser', () => {
    it('debe retornar la lista de proyectos en los que participa el usuario', async () => {
      projectRepo.findAllForUser!.mockResolvedValue([mockProject]);

      const result = await service.findAllForUser(mockUserId);

      expect(projectRepo.findAllForUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProjectId);
    });
  });

  describe('findOne', () => {
    it('debe retornar el proyecto si el usuario es miembro', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.OWNER);

      const result = await service.findOne(mockProjectId, mockUserId);

      expect(result).toHaveProperty('id', mockProjectId);
      expect(result.name).toBe('Test Project');
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      projectRepo.findById!.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar ForbiddenException si el usuario no es miembro ni creador', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(null);

      await expect(service.findOne(mockProjectId, 'stranger-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('debe actualizar el proyecto si el usuario es OWNER o EDITOR', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.OWNER);
      projectRepo.updateProject!.mockResolvedValue({
        ...mockProject,
        name: 'Updated Name',
      });

      const result = await service.update(
        mockProjectId,
        { name: 'Updated Name' },
        mockUserId,
      );

      expect(projectRepo.updateProject).toHaveBeenCalledWith(mockProjectId, {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('debe lanzar ForbiddenException si el usuario es VIEWER', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.VIEWER);

      await expect(
        service.update(mockProjectId, { name: 'Updated Name' }, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('debe eliminar el proyecto si el usuario es OWNER', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.OWNER);
      projectRepo.deleteProject!.mockResolvedValue();

      const result = await service.remove(mockProjectId, mockUserId);

      expect(projectRepo.deleteProject).toHaveBeenCalledWith(mockProjectId);
      expect(result.success).toBe(true);
    });

    it('debe lanzar ForbiddenException si un EDITOR intenta eliminar el proyecto', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.EDITOR);

      await expect(service.remove(mockProjectId, mockOtherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addMember', () => {
    it('debe agregar un nuevo miembro si el solicitante es OWNER', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.OWNER);
      userRepo.findByEmail!.mockResolvedValue({
        id: mockOtherUserId,
        fullName: 'Otro Usuario',
        email: 'otro@uagrm.edu.bo',
      } as User);
      projectRepo.findMember!.mockResolvedValue(null);
      projectRepo.addMember!.mockResolvedValue({
        id: 'mem-2',
        projectId: mockProjectId,
        userId: mockOtherUserId,
        role: ProjectRole.EDITOR,
        joinedAt: new Date(),
        project: {} as any,
        user: {} as any,
      });

      const result = await service.addMember(
        mockProjectId,
        { email: 'otro@uagrm.edu.bo', role: ProjectRole.EDITOR },
        mockUserId,
      );

      expect(projectRepo.addMember).toHaveBeenCalledWith(
        mockProjectId,
        mockOtherUserId,
        ProjectRole.EDITOR,
      );
      expect(result.userId).toBe(mockOtherUserId);
    });

    it('debe lanzar ConflictException si el usuario ya es miembro', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.OWNER);
      userRepo.findByEmail!.mockResolvedValue({
        id: mockOtherUserId,
        email: 'otro@uagrm.edu.bo',
      } as User);
      projectRepo.findMember!.mockResolvedValue({ id: 'mem-2' } as ProjectMember);

      await expect(
        service.addMember(
          mockProjectId,
          { email: 'otro@uagrm.edu.bo', role: ProjectRole.EDITOR },
          mockUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
