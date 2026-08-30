import { Test, TestingModule } from '@nestjs/testing';
import { CodeGeneratorController } from './code-generator.controller';
import { CodeGeneratorService } from '../services/code-generator.service';
import { User } from '../../auth/entities/user.entity';

describe('CodeGeneratorController', () => {
  let controller: CodeGeneratorController;
  let service: jest.Mocked<Partial<CodeGeneratorService>>;

  const mockUser: User = {
    id: 'user-111',
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

  beforeEach(async () => {
    service = {
      previewFromDiagramId: jest.fn().mockResolvedValue({
        projectName: 'Tienda Online',
        totalFiles: 15,
        files: [],
      }),
      previewFromAst: jest.fn().mockResolvedValue({
        projectName: 'AST Project',
        totalFiles: 15,
        files: [],
      }),
      downloadZipFromDiagramId: jest.fn().mockResolvedValue({
        filename: 'tienda-online.zip',
        buffer: Buffer.from('mock-zip-content'),
      }),
      downloadZipFromAst: jest.fn().mockResolvedValue({
        filename: 'ast-project.zip',
        buffer: Buffer.from('mock-zip-content'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeGeneratorController],
      providers: [{ provide: CodeGeneratorService, useValue: service }],
    }).compile();

    controller = module.get<CodeGeneratorController>(CodeGeneratorController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe generar la vista previa de archivos', async () => {
    const res = await controller.previewFromDiagramId(
      '11111111-1111-1111-1111-111111111111',
      {},
      mockUser,
    );
    expect(res.projectName).toBe('Tienda Online');
    expect(service.previewFromDiagramId).toHaveBeenCalled();
  });

  it('debe generar vista previa directa desde AST en memoria', async () => {
    const res = await controller.previewFromAst({ nodes: [], connections: [] });
    expect(res.projectName).toBe('AST Project');
    expect(service.previewFromAst).toHaveBeenCalled();
  });
});
