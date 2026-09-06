import { Test, TestingModule } from '@nestjs/testing';
import { DiagramVersionController } from './diagram-version.controller';
import { DiagramVersionService } from '../services/diagram-version.service';

describe('DiagramVersionController', () => {
  let controller: DiagramVersionController;
  let service: jest.Mocked<DiagramVersionService>;

  beforeEach(async () => {
    const mockService = {
      createDiagramVersion: jest.fn().mockResolvedValue({
        id: 'ver-1',
        diagramId: 'diag-1',
        versionTag: 'v1.0.0',
        astJson: {},
        createdBy: 'user-1',
        createdAt: new Date(),
      }),
      getDiagramVersions: jest.fn().mockResolvedValue([]),
      getDiagramVersionById: jest.fn().mockResolvedValue({
        id: 'ver-1',
        diagramId: 'diag-1',
        versionTag: 'v1.0.0',
        astJson: {},
        createdBy: 'user-1',
        createdAt: new Date(),
      }),
      restoreDiagramVersion: jest.fn().mockResolvedValue({
        name: 'Restored',
        nodes: [],
        connections: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiagramVersionController],
      providers: [
        { provide: DiagramVersionService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<DiagramVersionController>(DiagramVersionController);
    service = module.get(DiagramVersionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a version snapshot', async () => {
    const res = await controller.createVersion(
      'diag-1',
      { versionTag: 'v1.0.0' },
      { id: 'user-1', email: 'test@example.com' } as any,
    );
    expect(res).toBeDefined();
    expect(res.versionTag).toBe('v1.0.0');
    expect(service.createDiagramVersion).toHaveBeenCalled();
  });

  it('should list versions of a diagram', async () => {
    const res = await controller.getVersions('diag-1', { id: 'user-1' } as any);
    expect(res).toEqual([]);
    expect(service.getDiagramVersions).toHaveBeenCalled();
  });

  it('should get a version by id', async () => {
    const res = await controller.getVersionById('diag-1', 'ver-1', { id: 'user-1' } as any);
    expect(res.id).toBe('ver-1');
    expect(service.getDiagramVersionById).toHaveBeenCalled();
  });

  it('should restore a diagram version', async () => {
    const res = await controller.restoreVersion('diag-1', 'ver-1', { id: 'user-1' } as any);
    expect(res).toEqual({ name: 'Restored', nodes: [], connections: [] });
    expect(service.restoreDiagramVersion).toHaveBeenCalled();
  });
});
