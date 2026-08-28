import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DiagramService } from './diagram.service';
import { DiagramRepository } from '../repositories/diagram.repository';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { Diagram } from '../entities/diagram.entity';
import { Project } from '../../projects/entities/project.entity';

describe('DiagramService', () => {
  let service: DiagramService;
  let diagramRepo: jest.Mocked<Partial<DiagramRepository>>;
  let projectRepo: jest.Mocked<Partial<ProjectRepository>>;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockProjectId = '22222222-2222-2222-2222-222222222222';
  const mockDiagramId = '33333333-3333-3333-3333-333333333333';

  const mockProject: Project = {
    id: mockProjectId,
    name: 'Test Project',
    description: null,
    basePackage: 'com.example.app',
    javaVersion: 21,
    springBootVersion: '3.3.0',
    createdBy: mockUserId,
    createdAt: new Date(),
    creator: {} as any,
    members: [],
    diagrams: [],
  };

  const mockDiagram: Diagram = {
    id: mockDiagramId,
    projectId: mockProjectId,
    name: 'Main Class Diagram',
    version: '1.0.0',
    defaultLineStyle: 'segment',
    yjsBinaryState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: mockProject,
    nodes: [
      {
        id: 'node_1',
        diagramId: mockDiagramId,
        name: 'Usuario',
        positionX: 100,
        positionY: 200,
        width: 220,
        height: 150,
        isAnchor: false,
        assocMainConnId: null,
        diagram: {} as any,
        attributes: [
          {
            id: 'attr_1',
            nodeId: 'node_1',
            name: 'id',
            type: 'UUID',
            orderIndex: 0,
            node: {} as any,
          },
        ],
        methods: [
          {
            id: 'meth_1',
            nodeId: 'node_1',
            name: 'getId',
            parameters: '',
            returnType: 'UUID',
            orderIndex: 0,
            node: {} as any,
          },
        ],
        outgoingConnections: [],
        incomingConnections: [],
      },
    ],
    connections: [],
    versions: [],
    aiLogs: [],
    collaborationSessions: [],
  };

  beforeEach(async () => {
    diagramRepo = {
      createDiagram: jest.fn(),
      findAllByProjectId: jest.fn(),
      findById: jest.fn(),
      updateDiagram: jest.fn(),
      deleteDiagram: jest.fn(),
      saveAst: jest.fn(),
    };

    projectRepo = {
      findById: jest.fn(),
      getMemberRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagramService,
        { provide: DiagramRepository, useValue: diagramRepo },
        { provide: ProjectRepository, useValue: projectRepo },
      ],
    }).compile();

    service = module.get<DiagramService>(DiagramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe crear un nuevo diagrama si el usuario tiene rol OWNER/EDITOR', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.OWNER);
      diagramRepo.createDiagram!.mockResolvedValue(mockDiagram);
      diagramRepo.findById!.mockResolvedValue(mockDiagram);

      const result = await service.create(
        {
          projectId: mockProjectId,
          name: 'Main Class Diagram',
          version: '1.0.0',
        },
        mockUserId,
      );

      expect(diagramRepo.createDiagram).toHaveBeenCalled();
      expect(result.id).toBe(mockDiagramId);
      expect(result.nodes).toHaveLength(1);
    });

    it('debe lanzar ForbiddenException si el usuario es VIEWER al crear', async () => {
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.VIEWER);

      await expect(
        service.create(
          {
            projectId: mockProjectId,
            name: 'New Diagram',
          },
          'viewer-user-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('debe retornar el diagrama completo con su AST', async () => {
      diagramRepo.findById!.mockResolvedValue(mockDiagram);
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.VIEWER);

      const result = await service.findOne(mockDiagramId, mockUserId);

      expect(result.id).toBe(mockDiagramId);
      expect(result.name).toBe('Main Class Diagram');
      expect(result.nodes[0].name).toBe('Usuario');
    });

    it('debe lanzar NotFoundException si no existe el diagrama', async () => {
      diagramRepo.findById!.mockResolvedValue(null);

      await expect(service.findOne('invalid-id', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveAst', () => {
    it('debe persistir el AST del diagrama con nodos y conexiones', async () => {
      diagramRepo.findById!.mockResolvedValue(mockDiagram);
      projectRepo.findById!.mockResolvedValue(mockProject);
      projectRepo.getMemberRole!.mockResolvedValue(ProjectRole.EDITOR);
      diagramRepo.saveAst!.mockResolvedValue(mockDiagram);

      const result = await service.saveAst(
        mockDiagramId,
        {
          defaultLineStyle: 'segment',
          nodes: [
            {
              id: 'node_1',
              name: 'Usuario',
              positionX: 100,
              positionY: 200,
              attributes: [{ name: 'id', type: 'UUID' }],
              methods: [],
            },
          ],
          connections: [],
        },
        mockUserId,
      );

      expect(diagramRepo.saveAst).toHaveBeenCalled();
      expect(result.id).toBe(mockDiagramId);
    });
  });
});
