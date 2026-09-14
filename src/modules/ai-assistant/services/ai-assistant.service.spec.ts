import { Test, TestingModule } from '@nestjs/testing';
import { AiAssistantService } from './ai-assistant.service';
import { VertexAiService } from './vertex-ai.service';
import { CollaborationGateway } from '../../projects/gateways/collaboration.gateway';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let vertexAiService: jest.Mocked<VertexAiService>;
  let collaborationGateway: any;

  beforeEach(async () => {
    const mockVertexAiService = {
      generateContent: jest.fn(),
    };

    const mockCollaborationGateway = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
      lockNodeForAi: jest.fn(),
      unlockNodeForAi: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistantService,
        { provide: VertexAiService, useValue: mockVertexAiService },
        { provide: CollaborationGateway, useValue: mockCollaborationGateway },
      ],
    }).compile();

    service = module.get<AiAssistantService>(AiAssistantService);
    vertexAiService = module.get(VertexAiService);
    collaborationGateway = module.get(CollaborationGateway);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findNodeFuzzy', () => {
    it('debe encontrar nodos con nombres inexactos, plurales o con espacios', () => {
      const nodes = [
        { id: 'n1', name: 'DetalleCompra', position: { x: 0, y: 0 }, attributes: [], methods: [] },
        { id: 'n2', name: 'Usuario', position: { x: 0, y: 0 }, attributes: [], methods: [] },
      ];

      expect(service.findNodeFuzzy(nodes, 'Detalles de compra')?.name).toBe('DetalleCompra');
      expect(service.findNodeFuzzy(nodes, 'detalle de compra')?.name).toBe('DetalleCompra');
      expect(service.findNodeFuzzy(nodes, 'detalle_compra')?.name).toBe('DetalleCompra');
      expect(service.findNodeFuzzy(nodes, 'Usuarios')?.name).toBe('Usuario');
    });
  });

  describe('processTextPrompt', () => {
    it('debe eliminar la tabla y sus conexiones cuando se le pide "elimina la tabla Detalles de compra"', async () => {
      const currentNodes = [
        { id: 'node_compra', name: 'Compra', position: { x: 100, y: 100 }, attributes: [], methods: [] },
        { id: 'node_det_compra', name: 'DetalleCompra', position: { x: 400, y: 100 }, attributes: [], methods: [] },
      ];
      const currentConnections = [
        {
          id: 'conn_1',
          sourceNodeId: 'node_compra',
          targetNodeId: 'node_det_compra',
          sourceId: 'node_compra_right',
          targetId: 'node_det_compra_left',
          type: 'composition',
        },
      ];

      vertexAiService.generateContent.mockResolvedValueOnce(
        JSON.stringify({
          isClarificationRequired: false,
          action: 'diagram_mutated',
          message: 'Tabla DetalleCompra eliminada',
          nodes: [{ id: 'node_compra', name: 'Compra', position: { x: 100, y: 100 }, attributes: [], methods: [] }],
          connections: [],
        }),
      );

      const result = await service.processTextPrompt({
        prompt: 'elimina la tabla de Detalles de compra',
        diagramId: 'diag-123',
        roomCode: 'ROOM-1',
        currentNodes,
        currentConnections,
      });

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].name).toBe('Compra');
      expect(result.connections).toHaveLength(0);
      expect(collaborationGateway.server.to).toHaveBeenCalledWith('diagram_diag-123');
    });

    it('debe eliminar tablas cuando se usa infinitivo como "eliminar tabla DetalleCompra"', async () => {
      const currentNodes = [
        { id: 'node_compra', name: 'Compra', position: { x: 100, y: 100 }, attributes: [], methods: [] },
        { id: 'node_det_compra', name: 'DetalleCompra', position: { x: 400, y: 100 }, attributes: [], methods: [] },
      ];

      vertexAiService.generateContent.mockResolvedValueOnce(
        JSON.stringify({
          isClarificationRequired: false,
          action: 'diagram_mutated',
          message: 'Tabla DetalleCompra eliminada',
          nodes: [{ id: 'node_compra', name: 'Compra', position: { x: 100, y: 100 }, attributes: [], methods: [] }],
          connections: [],
        }),
      );

      const result = await service.processTextPrompt({
        prompt: 'eliminar tabla DetalleCompra',
        diagramId: 'diag-123',
        roomCode: 'ROOM-1',
        currentNodes,
        currentConnections: [],
      });

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].name).toBe('Compra');
    });

    it('debe eliminar un atributo específico cuando se le pide', async () => {
      const currentNodes = [
        {
          id: 'node_user',
          name: 'Usuario',
          position: { x: 100, y: 100 },
          attributes: [
            { name: 'id', type: 'UUID' },
            { name: 'rol', type: 'String' },
          ],
          methods: [],
        },
      ];

      vertexAiService.generateContent.mockResolvedValueOnce(
        JSON.stringify({
          isClarificationRequired: false,
          action: 'diagram_mutated',
          message: 'Atributo rol eliminado',
          nodes: [
            {
              id: 'node_user',
              name: 'Usuario',
              position: { x: 100, y: 100 },
              attributes: [{ name: 'id', type: 'UUID' }],
              methods: [],
            },
          ],
          connections: [],
        }),
      );

      const result = await service.processTextPrompt({
        prompt: 'elimina el atributo rol de la tabla Usuario',
        diagramId: 'diag-123',
        roomCode: 'ROOM-1',
        currentNodes,
        currentConnections: [],
      });

      expect(result.success).toBe(true);
      expect(result.nodes[0].attributes).toHaveLength(1);
      expect(result.nodes[0].attributes[0].name).toBe('id');
    });

    it('debe mutar el diagrama agregando la nueva tabla y deduplicando atributos', async () => {
      const currentNodes = [
        {
          id: 'node_1',
          name: 'Usuario',
          position: { x: 100, y: 80 },
          width: 220,
          attributes: [{ name: 'id', type: 'UUID' }],
          methods: [],
        },
      ];

      const mockVertexResponse = JSON.stringify({
        isClarificationRequired: false,
        message: 'Se creó la tabla Producto y su relación con Usuario.',
        changesSummary: 'Tabla Producto creada con 3 atributos y relación con Usuario',
        nodes: [
          {
            id: 'node_prod',
            name: 'Producto',
            position: { x: 760, y: 80 },
            width: 220,
            attributes: [
              { name: 'id', type: 'UUID' },
              { name: 'nombre', type: 'String' },
              { name: 'precio', type: 'Double' },
            ],
            methods: [{ name: 'getId', parameters: '', returnType: 'UUID' }],
          },
        ],
        connections: [
          {
            id: 'conn_prod_user',
            sourceNodeId: 'node_prod',
            targetNodeId: 'node_1',
            sourceId: 'node_prod_right',
            targetId: 'node_1_left',
            type: 'association',
            sourceMultiplicity: '*',
            targetMultiplicity: '1',
          },
        ],
      });

      vertexAiService.generateContent.mockResolvedValue(mockVertexResponse);

      const result = await service.processTextPrompt({
        prompt: 'Crea una tabla Producto con atributos id UUID, nombre String, precio Double y relacionala con Usuarios con multiplicidad *',
        diagramId: 'diag-123',
        roomCode: 'ROOM-1',
        currentNodes,
        currentConnections: [],
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('diagram_mutated');
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map(n => n.name)).toContain('Usuario');
      expect(result.nodes.map(n => n.name)).toContain('Producto');
    });
  });
});
