import { Test, TestingModule } from '@nestjs/testing';
import { AiAssistantService } from './ai-assistant.service';
import { VertexAiService } from './vertex-ai.service';
import { CollaborationGateway } from '../../collaboration/gateways/collaboration.gateway';

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

  describe('processTextPrompt', () => {
    it('debe mutar el diagrama agregando la nueva tabla y preservando las existentes', async () => {
      const currentNodes = [
        {
          id: 'node_1',
          name: 'Usuario',
          position: { x: 100, y: 80 },
          width: 220,
          attributes: [{ name: 'id', type: 'UUID' }],
          methods: [],
        },
        {
          id: 'node_2',
          name: 'Role',
          position: { x: 480, y: 80 },
          width: 220,
          attributes: [{ name: 'id', type: 'UUID' }],
          methods: [],
        },
      ];

      const currentConnections = [
        {
          id: 'conn_1_2',
          sourceNodeId: 'node_1',
          targetNodeId: 'node_2',
          sourceId: 'node_1_right',
          targetId: 'node_2_left',
          type: 'association',
        },
      ];

      // Simulamos que Vertex AI retorna la nueva tabla Producto y la relación con Usuario
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
            targetNodeId: 'Usuario',
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
        currentConnections,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('diagram_mutated');
      // Debe contener las 2 tablas existentes + la nueva tabla Producto = 3 tablas
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map(n => n.name)).toContain('Usuario');
      expect(result.nodes.map(n => n.name)).toContain('Role');
      expect(result.nodes.map(n => n.name)).toContain('Producto');
      // Debe contener la conexión previa + la nueva conexión con Usuario = 2 conexiones
      expect(result.connections.length).toBeGreaterThanOrEqual(2);
      expect(collaborationGateway.server.to).toHaveBeenCalledWith('diagram_diag-123');
    });

    it('debe solicitar aclaración (Guardrail) si el usuario pide un modelo de negocio ambiguo sin estructura', async () => {
      const mockVertexResponse = JSON.stringify({
        isClarificationRequired: true,
        message: 'Por favor especifica las tablas y atributos concretos que requieres para el diagrama.',
        changesSummary: 'Aclaración requerida',
        nodes: [],
        connections: [],
      });

      vertexAiService.generateContent.mockResolvedValue(mockVertexResponse);

      const result = await service.processTextPrompt({
        prompt: 'Hola, este es mi negocio de compra venta... hazme un diagrama entero',
        diagramId: 'diag-123',
        currentNodes: [],
        currentConnections: [],
      });

      expect(result.success).toBe(false);
      expect(result.action).toBe('clarification_required');
      expect(result.message).toContain('especifica');
    });
  });

  describe('processVisionDiagram', () => {
    it('debe digitalizar y extraer nodos y relaciones desde una imagen de diagrama', async () => {
      const mockVertexResponse = JSON.stringify({
        isClarificationRequired: false,
        message: 'Diagrama digitalizado con éxito.',
        changesSummary: '2 clases y 1 relación extraídas',
        nodes: [
          {
            id: 'node_1',
            name: 'Cliente',
            position: { x: 100, y: 100 },
            width: 220,
            attributes: [{ name: 'id', type: 'UUID' }, { name: 'email', type: 'String' }],
            methods: [],
          },
          {
            id: 'node_2',
            name: 'Factura',
            position: { x: 400, y: 100 },
            width: 220,
            attributes: [{ name: 'id', type: 'UUID' }, { name: 'total', type: 'Double' }],
            methods: [],
          },
        ],
        connections: [
          {
            id: 'conn_1',
            sourceNodeId: 'node_1',
            targetNodeId: 'node_2',
            sourceId: 'node_1_right',
            targetId: 'node_2_left',
            type: 'association',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
          },
        ],
      });

      vertexAiService.generateContent.mockResolvedValue(mockVertexResponse);

      const result = await service.processVisionDiagram({
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
        prompt: 'Digitaliza el diagrama de la imagen',
        diagramId: 'diag-123',
        currentNodes: [],
        currentConnections: [],
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('vision_extract');
      expect(result.nodes).toHaveLength(2);
      expect(result.connections).toHaveLength(1);
      expect(collaborationGateway.server.to).toHaveBeenCalledWith('diagram_diag-123');
    });
  });
});
