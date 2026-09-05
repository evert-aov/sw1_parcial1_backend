import { Test, TestingModule } from '@nestjs/testing';
import { XmiInteropService } from './xmi-interop.service';
import { XmiExporterService } from './xmi-exporter.service';
import { XmiParserService } from './xmi-parser.service';
import { DiagramVersionRepository } from '../repositories/diagram-version.repository';
import { DiagramRepository } from '../../diagrams/repositories/diagram.repository';
import { DiagramService } from '../../diagrams/services/diagram.service';
import { ProjectRepository } from '../../projects/repositories/project.repository';
import { ProjectMemberRepository } from '../../projects/repositories/project-member.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';

describe('XmiInteropService', () => {
  let service: XmiInteropService;
  let diagramRepo: jest.Mocked<DiagramRepository>;
  let diagramService: jest.Mocked<DiagramService>;
  let versionRepo: jest.Mocked<DiagramVersionRepository>;
  let projectRepo: jest.Mocked<ProjectRepository>;
  let memberRepo: jest.Mocked<ProjectMemberRepository>;

  beforeEach(async () => {
    const mockDiagramRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'diag-1',
        projectId: 'proj-1',
        name: 'Diagrama Ventas',
        defaultLineStyle: 'segment',
        nodes: [
          {
            id: 'n1',
            name: 'Cliente',
            positionX: 100,
            positionY: 100,
            width: 220,
            height: 120,
            attributes: [],
            methods: [],
          },
        ],
        connections: [],
      }),
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 'diag-new' })),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, id: 'diag-new' })),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockDiagramService = {
      saveAst: jest.fn().mockResolvedValue({ id: 'diag-1' } as any),
      create: jest.fn().mockResolvedValue({ id: 'diag-new' } as any),
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
      findByDiagramId: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({
        id: 'v1',
        diagramId: 'diag-1',
        versionTag: 'v1.0.0',
        astJson: { name: 'Diagrama Ventas', nodes: [], connections: [] },
        diagram: { id: 'diag-1', projectId: 'proj-1', name: 'Diagrama Ventas' },
      }),
    };

    const mockProjectRepo = {
      findById: jest.fn(),
    };

    const mockMemberRepo = {
      findByProjectIdAndUserId: jest.fn().mockResolvedValue({
        id: 'm1',
        projectId: 'proj-1',
        userId: 'u1',
        role: ProjectRole.OWNER,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XmiInteropService,
        XmiExporterService,
        XmiParserService,
        { provide: DiagramRepository, useValue: mockDiagramRepo },
        { provide: DiagramService, useValue: mockDiagramService },
        { provide: DiagramVersionRepository, useValue: mockVersionRepo },
        { provide: ProjectRepository, useValue: mockProjectRepo },
        { provide: ProjectMemberRepository, useValue: mockMemberRepo },
      ],
    }).compile();

    service = module.get<XmiInteropService>(XmiInteropService);
    diagramRepo = module.get(DiagramRepository);
    diagramService = module.get(DiagramService);
    versionRepo = module.get(DiagramVersionRepository);
    projectRepo = module.get(ProjectRepository);
    memberRepo = module.get(ProjectMemberRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should export diagram from DB to XMI', async () => {
    const res = await service.exportDiagramToXmi('diag-1', 'u1');
    expect(res).toBeDefined();
    expect(res.filename).toContain('diagrama_ventas_ea.xmi');
    expect(res.xmiContent).toContain('<xmi:XMI');
    expect(res.xmiContent).toContain('name="Cliente"');
  });

  it('should create a diagram version snapshot', async () => {
    const res = await service.createDiagramVersion('diag-1', { versionTag: 'v1.0.0' }, 'u1');
    expect(res).toBeDefined();
    expect(res.versionTag).toBe('v1.0.0');
    expect(versionRepo.save).toHaveBeenCalled();
  });

  it('should restore a diagram version', async () => {
    const res = await service.restoreDiagramVersion('diag-1', 'v1', 'u1');
    expect(res).toBeDefined();
    expect(diagramService.saveAst).toHaveBeenCalled();
  });
});
