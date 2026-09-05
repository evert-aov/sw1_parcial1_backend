import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectRepository } from '../repositories/project.repository';
import { ProjectMemberRepository } from '../repositories/project-member.repository';
import { UserRepository } from '../../auth/repositories/user.repository';
import { DiagramRepository } from '../../diagrams/repositories/diagram.repository';
import { ProjectRole } from '../entities/project-role.enum';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { User } from '../../auth/entities/user.entity';

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepo: jest.Mocked<Partial<ProjectRepository>>;
  let memberRepo: jest.Mocked<Partial<ProjectMemberRepository>>;
  let userRepo: jest.Mocked<Partial<UserRepository>>;
  let diagramRepo: jest.Mocked<Partial<DiagramRepository>>;

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
      create: jest.fn().mockImplementation((data) => ({ ...data, id: mockProjectId } as Project)),
      save: jest.fn().mockImplementation((proj) => Promise.resolve({ ...proj, id: mockProjectId } as Project)),
      findAllForUser: jest.fn(),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    memberRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'mem-1' } as ProjectMember)),
      save: jest.fn().mockImplementation((mem) => Promise.resolve({ ...mem, id: 'mem-1' } as ProjectMember)),
      findByProjectIdAndUserId: jest.fn(),
      findRole: jest.fn(),
      findByProjectId: jest.fn(),
      updateRole: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };

    diagramRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'diag-1' } as any)),
      save: jest.fn().mockResolvedValue({ id: 'diag-1' } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: projectRepo },
        { provide: ProjectMemberRepository, useValue: memberRepo },
        { provide: UserRepository, useValue: userRepo },
        { provide: DiagramRepository, useValue: diagramRepo },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe crear un nuevo proyecto exitosamente', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);

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

      expect(projectRepo.create).toHaveBeenCalled();
      expect(projectRepo.save).toHaveBeenCalled();
      expect(memberRepo.create).toHaveBeenCalledWith({
        projectId: mockProjectId,
        userId: mockUserId,
        role: ProjectRole.OWNER,
      });
      expect(memberRepo.save).toHaveBeenCalled();
      expect(diagramRepo.create).toHaveBeenCalledWith({
        projectId: mockProjectId,
        name: 'Test Project - Diagrama Principal',
        version: '1.0.0',
        defaultLineStyle: 'segment',
      });
      expect(diagramRepo.save).toHaveBeenCalled();
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
      memberRepo.findRole!.mockResolvedValue(ProjectRole.OWNER);

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
      memberRepo.findRole!.mockResolvedValue(null);

      await expect(service.findOne(mockProjectId, 'stranger-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('debe actualizar el proyecto si el usuario es OWNER o EDITOR', async () => {
      projectRepo.findById!
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce({
          ...mockProject,
          name: 'Updated Name',
        });
      memberRepo.findRole!.mockResolvedValue(ProjectRole.OWNER);

      const result = await service.update(
        mockProjectId,
        { name: 'Updated Name' },
        mockUserId,
      );

      expect(projectRepo.update).toHaveBeenCalledWith(mockProjectId, {
        name: 'Updated Name',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('debe lanzar ForbiddenException si el usuario es VIEWER', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      memberRepo.findRole!.mockResolvedValue(ProjectRole.VIEWER);

      await expect(
        service.update(mockProjectId, { name: 'Updated Name' }, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('debe eliminar el proyecto si el usuario es OWNER', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      memberRepo.findRole!.mockResolvedValue(ProjectRole.OWNER);

      const result = await service.remove(mockProjectId, mockUserId);

      expect(projectRepo.delete).toHaveBeenCalledWith(mockProjectId);
      expect(result.success).toBe(true);
    });

    it('debe lanzar ForbiddenException si un EDITOR intenta eliminar el proyecto', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      memberRepo.findRole!.mockResolvedValue(ProjectRole.EDITOR);

      await expect(service.remove(mockProjectId, mockOtherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addMember', () => {
    it('debe agregar un nuevo miembro si el solicitante es OWNER', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      memberRepo.findRole!.mockResolvedValue(ProjectRole.OWNER);
      userRepo.findByEmail!.mockResolvedValue({
        id: mockOtherUserId,
        fullName: 'Otro Usuario',
        email: 'otro@uagrm.edu.bo',
      } as User);
      memberRepo.findByProjectIdAndUserId!.mockResolvedValue(null);
      memberRepo.create!.mockReturnValue({
        id: 'mem-2',
        projectId: mockProjectId,
        userId: mockOtherUserId,
        role: ProjectRole.EDITOR,
        joinedAt: new Date(),
        project: {} as any,
        user: {} as any,
      });
      memberRepo.save!.mockResolvedValue({
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

      expect(memberRepo.create).toHaveBeenCalledWith({
        projectId: mockProjectId,
        userId: mockOtherUserId,
        role: ProjectRole.EDITOR,
      });
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe(mockOtherUserId);
    });

    it('debe lanzar ConflictException si el usuario ya es miembro', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      memberRepo.findRole!.mockResolvedValue(ProjectRole.OWNER);
      userRepo.findByEmail!.mockResolvedValue({
        id: mockOtherUserId,
        email: 'otro@uagrm.edu.bo',
      } as User);
      memberRepo.findByProjectIdAndUserId!.mockResolvedValue({ id: 'mem-2' } as ProjectMember);

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
