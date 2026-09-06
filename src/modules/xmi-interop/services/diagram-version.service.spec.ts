import { Test, TestingModule } from '@nestjs/testing';
import { DiagramVersionService } from './diagram-version.service';
import { DiagramVersionRepository } from '../repositories/diagram-version.repository';
import { DiagramRepository } from '../../diagrams/repositories/diagram.repository';
import { DiagramService } from '../../diagrams/services/diagram.service';
import { XmiExporterService } from './xmi-exporter.service';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { ProjectMemberRepository } from '../../projects/repositories/project-member.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';

describe('DiagramVersionService', () => {
  let service: DiagramVersionService;
  let versionRepo: jest.Mocked<DiagramVersionRepository>;
  let diagramRepo: jest.Mocked<DiagramRepository>;
  let diagramService: jest.Mocked<DiagramService>;
  let memberRepo: jest.Mocked<ProjectMemberRepository>;

  beforeEach(async () => {
    const mockDiagramRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'diag-1',
        projectId: 'proj-1',
        name: 'Diagrama Test',
        defaultLineStyle: 'segment',
        nodes: [],
        connections: [],
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockDiagramService = {
      saveAst: jest.fn().mockResolvedValue({ id: 'diag-1' } as any),
    };

    const mockVersionRepo = {
      create: jest.fn().mockImplementation((data) => ({
        id: 'v1',
        createdAt: new Date(),
        ...data,
      })),
      save: jest.fn().mockImplementation((v) =>
        Promise.resolve({
          id: 'v1',
          createdAt: new Date(),
          ...v,
        }),
      ),
      findByDiagramAndTag: jest.fn().mockResolvedValue(null),
      findByDiagramId: jest.fn().mockResolvedValue([
        {
          id: 'v1',
          diagramId: 'diag-1',
          versionTag: 'v1.0.0',
          astJson: {},
          xmiContent: '<xmi/>',
          createdBy: 'u1',
          createdAt: new Date(),
        },
      ]),
      findById: jest.fn().mockResolvedValue({
        id: 'v1',
        diagramId: 'diag-1',
        versionTag: 'v1.0.0',
        astJson: { name: 'Diagrama Test', nodes: [], connections: [] },
        xmiContent: '<xmi/>',
        createdBy: 'u1',
        createdAt: new Date(),
        diagram: { id: 'diag-1', projectId: 'proj-1' },
      }),
    };

    const mockExporterService = {
      exportToXmi: jest.fn().mockReturnValue('<xmi:XMI></xmi:XMI>'),
    };

    const mockProjectRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'proj-1', createdBy: 'u1' }),
    };

    const mockMemberRepo = {
      findByProjectIdAndUserId: jest.fn().mockResolvedValue({
        id: 'm1',
        projectId: 'proj-1',
        userId: 'u1',
        role: ProjectRole.OWNER,
      }),
      findRole: jest.fn().mockResolvedValue(ProjectRole.OWNER),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagramVersionService,
        { provide: DiagramVersionRepository, useValue: mockVersionRepo },
        { provide: DiagramRepository, useValue: mockDiagramRepo },
        { provide: DiagramService, useValue: mockDiagramService },
        { provide: XmiExporterService, useValue: mockExporterService },
        { provide: ProjectRepository, useValue: mockProjectRepo },
        { provide: ProjectMemberRepository, useValue: mockMemberRepo },
      ],
    }).compile();

    service = module.get<DiagramVersionService>(DiagramVersionService);
    versionRepo = module.get(DiagramVersionRepository);
    diagramRepo = module.get(DiagramRepository);
    diagramService = module.get(DiagramService);
    memberRepo = module.get(ProjectMemberRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a diagram version snapshot', async () => {
    const res = await service.createDiagramVersion('diag-1', { versionTag: 'v1.0.0' }, 'u1');
    expect(res).toBeDefined();
    expect(res.versionTag).toBe('v1.0.0');
    expect(versionRepo.save).toHaveBeenCalled();
  });

  it('should list diagram versions', async () => {
    const res = await service.getDiagramVersions('diag-1', 'u1');
    expect(res).toHaveLength(1);
    expect(res[0].versionTag).toBe('v1.0.0');
  });

  it('should get a version by id', async () => {
    const res = await service.getDiagramVersionById('diag-1', 'v1', 'u1');
    expect(res).toBeDefined();
    expect(res.id).toBe('v1');
  });

  it('should restore a diagram version', async () => {
    const res = await service.restoreDiagramVersion('diag-1', 'v1', 'u1');
    expect(res).toBeDefined();
    expect(diagramService.saveAst).toHaveBeenCalled();
  });
});
