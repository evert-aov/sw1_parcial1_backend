import { Injectable, Logger } from '@nestjs/common';
import { VertexAiService } from './vertex-ai.service';
import { CollaborationGateway } from '../../collaboration/gateways/collaboration.gateway';
import { AiPromptDto } from '../dtos/ai-prompt.dto';
import { AiVisionPromptDto } from '../dtos/ai-vision-prompt.dto';
import { AiResponseDto } from '../dtos/ai-response.dto';

export interface UmlClassNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  isAnchor?: boolean;
  assocMainConnId?: string;
  attributes: { name: string; type: string }[];
  methods: { name: string; parameters: string; returnType: string }[];
}

export interface UmlConnection {
  id: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceId: string;
  targetId: string;
  type: string;
  lineStyle?: string;
  name?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  assocAnchorNodeId?: string;
}

const UML_SYSTEM_INSTRUCTION = `
Eres un Asistente Experto en Modelado UML 2.5 y Arquitectura de Software para una herramienta CASE interactiva.
Tu función es interpretar comandos de edición estructural de diagramas de clases UML y generar las mutaciones precisas sobre el Árbol de Sintaxis Abstracta (AST) en formato JSON.

REGLAS DE ORO / GUARDRAILS:
1. NO inventes modelos de negocio ambiguos desde cero si el usuario solo te narra una historia general (ej: "este es mi negocio de ventas... hazme el diagrama"). Si el usuario pide que le inventes un sistema entero sin especificar tablas, atributos o relaciones concretas, DEBES responder con "isClarificationRequired": true y un mensaje cordial indicando que necesitas comandos estructurales concretos (nombres de tablas, atributos o relaciones) o una imagen del diagrama.
2. Si el usuario te da una instrucción estructural (ej: "crea la tabla Producto con id UUID, nombre String, precio Double y conéctala con Usuarios con multiplicidad *"), DEBES procesarla con precisión técnica y generar el AST resultante.
3. PRESERVACIÓN DE NODOS Y CONEXIONES EXISTENTES:
   El arreglo "nodes" y "connections" devuelto DEBE PRESERVAR TODOS los nodos y conexiones que ya existían en el diagrama ("NODOS ACTUALES"), agregando los nuevos nodos o modificando los solicitados. NUNCA descartes ni borres tablas existentes a menos que el usuario lo pida explícitamente (ej: "elimina la tabla X").
4. CONEXIONES Y NOMBRES:
   Al conectar con tablas existentes (ej: "Usuarios" o "Usuario"), identifica el ID del nodo correspondiente en "NODOS ACTUALES" y genera la conexión referenciando los IDs correctos ("sourceNodeId" y "targetNodeId").

TIPOS DE DATOS VÁLIDOS (Backend & SQL):
- Atributos: UUID, String, Integer, Long, Boolean, Double, Float, BigDecimal, LocalDate, LocalDateTime, Date, Text, byte[]
- Métodos (Retorno): void, UUID, String, Integer, Long, Boolean, Double, BigDecimal, LocalDate, LocalDateTime, List<Object>, Object

TIPOS DE RELACIONES UML:
- association, generalization, realization, composition, aggregation, dependency, association_class

FORMATO DE SALIDA ESTRICTO (JSON):
Debes responder ÚNICAMENTE con un bloque JSON sin texto markdown adicional:
{
  "isClarificationRequired": false,
  "message": "Descripción detallada de las tablas y relaciones creadas/modificadas",
  "changesSummary": "Resumen conciso (ej: Se creó la tabla Producto y su relación con Usuario)",
  "nodes": [
    {
      "id": "node_xxx",
      "name": "NombreClase",
      "position": { "x": 100, "y": 100 },
      "width": 220,
      "attributes": [{ "name": "id", "type": "UUID" }],
      "methods": [{ "name": "getId", "parameters": "", "returnType": "UUID" }]
    }
  ],
  "connections": [
    {
      "id": "conn_xxx",
      "sourceNodeId": "node_1",
      "targetNodeId": "node_2",
      "sourceId": "node_1_right",
      "targetId": "node_2_left",
      "type": "association",
      "lineStyle": "segment",
      "name": "posee",
      "sourceMultiplicity": "1",
      "targetMultiplicity": "0..*"
    }
  ]
}
`;

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly vertexAiService: VertexAiService,
    private readonly collaborationGateway: CollaborationGateway,
  ) {}

  async processTextPrompt(dto: AiPromptDto): Promise<AiResponseDto> {
    const currentNodes: UmlClassNode[] = dto.currentNodes || [];
    const currentConnections: UmlConnection[] = dto.currentConnections || [];

    const userContent = `
ESTADO ACTUAL DEL DIAGRAMA:
NODOS ACTUALES (${currentNodes.length}):
${JSON.stringify(currentNodes, null, 2)}

CONEXIONES ACTUALES (${currentConnections.length}):
${JSON.stringify(currentConnections, null, 2)}

INSTRUCCIÓN DEL USUARIO:
"${dto.prompt}"

Genera el estado resultante completo del diagrama con las mutaciones aplicadas (asegurando preservar todas las tablas existentes y agregando las nuevas solicitadas con conexiones adecuadas).`;

    try {
      const responseText = await this.vertexAiService.generateContent({
        systemInstruction: UML_SYSTEM_INSTRUCTION,
        contents: userContent,
        responseMimeType: 'application/json',
      });

      const parsed = this.cleanAndParseJson(responseText);

      if (parsed.isClarificationRequired) {
        return {
          success: false,
          action: 'clarification_required',
          message: parsed.message || 'Por favor especifica las tablas, atributos o relaciones que deseas crear o modificar.',
          nodes: currentNodes,
          connections: currentConnections,
          changesSummary: 'Aclaración requerida sobre la estructura solicitada.',
        };
      }

      // Fusión inteligente para garantizar que NINGÚN nodo existente se pierda
      const merged = this.mergeNodesAndConnections(
        currentNodes,
        currentConnections,
        parsed.nodes || [],
        parsed.connections || [],
        dto.prompt,
      );

      const finalNodes = this.sanitizeNodes(merged.nodes);
      const finalConnections = this.sanitizeConnections(merged.connections, finalNodes);

      // Transmitir en tiempo real mediante el WebSocket Gateway como colaborador IA
      this.broadcastAiMutation(dto.diagramId, dto.roomCode, finalNodes, finalConnections, parsed.changesSummary || 'Mutación estructural aplicada');

      return {
        success: true,
        action: 'diagram_mutated',
        message: parsed.message || 'Diagrama actualizado por Copilot IA.',
        nodes: finalNodes,
        connections: finalConnections,
        changesSummary: parsed.changesSummary || 'Mutación estructural aplicada al diagrama UML.',
      };
    } catch (err: any) {
      this.logger.error(`Error procesando prompt de texto IA: ${err.message || err}`);
      // Fallback heurístico en caso de error
      return this.handleFallbackPrompt(dto, currentNodes, currentConnections);
    }
  }

  async processVisionDiagram(dto: AiVisionPromptDto): Promise<AiResponseDto> {
    const currentNodes: UmlClassNode[] = dto.currentNodes || [];
    const currentConnections: UmlConnection[] = dto.currentConnections || [];

    const cleanBase64 = dto.imageBase64.includes('base64,')
      ? dto.imageBase64.split('base64,')[1]
      : dto.imageBase64;

    const visionSystemInstruction = `
${UML_SYSTEM_INSTRUCTION}

INSTRUCCIÓN ADICIONAL PARA VISIÓN COMPUTACIONAL (IMÁGENES):
Analiza detalladamente la imagen adjunta del diagrama de clases UML (puede ser un dibujo en pizarra, captura de pantalla o boceto).
Extrae:
1. Cada una de las clases con su nombre exacto en PascalCase.
2. Todos los atributos detectados con sus tipos mapeados a los tipos válidos soportados.
3. Todos los métodos detectados con sus parámetros y tipos de retorno.
4. Todas las relaciones entre clases con sus multiplicidades detectadas y tipos UML correspondientes.
5. Asigna posiciones (x, y) ordenadas y separadas en una cuadrícula clara.
`;

    try {
      const contents = [
        {
          inlineData: {
            mimeType: dto.mimeType || 'image/png',
            data: cleanBase64,
          },
        },
        {
          text: dto.prompt
            ? `Instrucción adicional: "${dto.prompt}". Extrae todo el diagrama de clases de la imagen adjunta.`
            : 'Digitaliza y extrae todas las clases, atributos, métodos y relaciones UML de esta imagen.',
        },
      ];

      const responseText = await this.vertexAiService.generateContent({
        systemInstruction: visionSystemInstruction,
        contents,
        responseMimeType: 'application/json',
      });

      const parsed = this.cleanAndParseJson(responseText);

      const updatedNodes = this.sanitizeNodes(parsed.nodes || []);
      const updatedConnections = this.sanitizeConnections(parsed.connections || [], updatedNodes);

      // Transmitir en tiempo real mediante el WebSocket Gateway como colaborador IA
      this.broadcastAiMutation(
        dto.diagramId,
        dto.roomCode,
        updatedNodes,
        updatedConnections,
        `Digitalización visual de diagrama completada (${updatedNodes.length} clases detectadas)`,
      );

      return {
        success: true,
        action: 'vision_extract',
        message: parsed.message || `Se digitalizaron ${updatedNodes.length} clases y ${updatedConnections.length} relaciones desde la imagen.`,
        nodes: updatedNodes,
        connections: updatedConnections,
        changesSummary: `Digitalización visual completada: ${updatedNodes.length} clases y ${updatedConnections.length} relaciones extraídas.`,
      };
    } catch (err: any) {
      this.logger.error(`Error procesando visión de diagrama IA: ${err.message || err}`);
      throw err;
    }
  }

  private mergeNodesAndConnections(
    currentNodes: UmlClassNode[],
    currentConnections: UmlConnection[],
    aiNodes: UmlClassNode[],
    aiConnections: UmlConnection[],
    prompt: string,
  ): { nodes: UmlClassNode[]; connections: UmlConnection[] } {
    const isExplicitDelete = /(?:elimina|borra|quita|delete|remove)\s+(?:la\s+tabla|la\s+clase|el\s+nodo)/i.test(prompt);

    const mergedNodesMap = new Map<string, UmlClassNode>();
    const nodeByNameMap = new Map<string, UmlClassNode>();

    // 1. Registrar nodos actuales
    for (const node of currentNodes) {
      mergedNodesMap.set(node.id, { ...node });
      nodeByNameMap.set(node.name.toLowerCase(), node);
      // Soporte para variaciones en plural (ej: "Usuarios" -> "Usuario")
      if (node.name.endsWith('s')) {
        nodeByNameMap.set(node.name.slice(0, -1).toLowerCase(), node);
      } else {
        nodeByNameMap.set((node.name + 's').toLowerCase(), node);
      }
    }

    // 2. Fusionar nodos generados por la IA
    let maxPosX = currentNodes.reduce((max, n) => Math.max(max, n.position.x + (n.width || 220)), 50);
    let maxPosY = 80;

    for (const aiNode of aiNodes) {
      const existingById = mergedNodesMap.get(aiNode.id);
      const existingByName = nodeByNameMap.get(aiNode.name.toLowerCase());

      if (existingById) {
        // Actualizar nodo existente por ID
        mergedNodesMap.set(aiNode.id, {
          ...existingById,
          name: aiNode.name || existingById.name,
          attributes: (aiNode.attributes && aiNode.attributes.length > 0) ? aiNode.attributes : existingById.attributes,
          methods: (aiNode.methods && aiNode.methods.length > 0) ? aiNode.methods : existingById.methods,
        });
      } else if (existingByName && !isExplicitDelete) {
        // Actualizar nodo existente por Nombre
        mergedNodesMap.set(existingByName.id, {
          ...existingByName,
          name: aiNode.name || existingByName.name,
          attributes: (aiNode.attributes && aiNode.attributes.length > 0) ? aiNode.attributes : existingByName.attributes,
          methods: (aiNode.methods && aiNode.methods.length > 0) ? aiNode.methods : existingByName.methods,
        });
      } else {
        // Es un nuevo nodo: calcular posición limpia sin superposición
        const newId = aiNode.id && !aiNode.id.startsWith('node_xxx') ? aiNode.id : `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        let posX = aiNode.position?.x;
        let posY = aiNode.position?.y;

        if (posX === undefined || posX < 50 || (currentNodes.some(n => Math.abs(n.position.x - posX!) < 50 && Math.abs(n.position.y - posY!) < 50))) {
          posX = maxPosX + 60;
          posY = maxPosY;
          maxPosX = posX + 220;
        }

        const newNode: UmlClassNode = {
          id: newId,
          name: aiNode.name,
          position: { x: posX, y: posY },
          width: aiNode.width || 220,
          attributes: aiNode.attributes || [],
          methods: aiNode.methods || [],
        };

        mergedNodesMap.set(newId, newNode);
        nodeByNameMap.set(newNode.name.toLowerCase(), newNode);
      }
    }

    const mergedNodes = Array.from(mergedNodesMap.values());

    // 3. Fusionar conexiones
    const mergedConnsMap = new Map<string, UmlConnection>();

    for (const conn of currentConnections) {
      mergedConnsMap.set(conn.id, { ...conn });
    }

    for (const aiConn of aiConnections) {
      // Resolver ID real de origen
      let sourceNode = mergedNodes.find(n => n.id === aiConn.sourceNodeId);
      if (!sourceNode && aiConn.sourceNodeId) {
        sourceNode = nodeByNameMap.get(aiConn.sourceNodeId.toLowerCase());
      }
      if (!sourceNode && aiConn.sourceId) {
        const rawName = aiConn.sourceId.replace(/_(top|bottom|left|right)$/, '');
        sourceNode = mergedNodes.find(n => n.id === rawName) || nodeByNameMap.get(rawName.toLowerCase());
      }

      // Resolver ID real de destino
      let targetNode = mergedNodes.find(n => n.id === aiConn.targetNodeId);
      if (!targetNode && aiConn.targetNodeId) {
        targetNode = nodeByNameMap.get(aiConn.targetNodeId.toLowerCase());
      }
      if (!targetNode && aiConn.targetId) {
        const rawName = aiConn.targetId.replace(/_(top|bottom|left|right)$/, '');
        targetNode = mergedNodes.find(n => n.id === rawName) || nodeByNameMap.get(rawName.toLowerCase());
      }

      if (sourceNode && targetNode) {
        const connId = aiConn.id && !aiConn.id.startsWith('conn_xxx') ? aiConn.id : `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        mergedConnsMap.set(connId, {
          id: connId,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          sourceId: `${sourceNode.id}_right`,
          targetId: `${targetNode.id}_left`,
          type: aiConn.type || 'association',
          lineStyle: aiConn.lineStyle || 'segment',
          name: aiConn.name,
          sourceMultiplicity: aiConn.sourceMultiplicity || '',
          targetMultiplicity: aiConn.targetMultiplicity || '',
        });
      }
    }

    const mergedConnections = Array.from(mergedConnsMap.values());

    return {
      nodes: mergedNodes,
      connections: mergedConnections,
    };
  }

  private broadcastAiMutation(
    diagramId: string,
    roomCode: string | undefined,
    nodes: UmlClassNode[],
    connections: UmlConnection[],
    summary: string,
  ): void {
    try {
      if (!this.collaborationGateway?.server) return;

      const payload = {
        nodes,
        connections,
        userId: 'ai_copilot_vertex',
        userName: '✨ Copilot IA (Vertex AI)',
        action: 'ai_mutation',
      };

      const chatPayload = {
        userId: 'ai_copilot_vertex',
        userName: '✨ Copilot IA (Vertex AI)',
        message: `🤖 ${summary}`,
        timestamp: new Date().toISOString(),
      };

      if (diagramId) {
        this.collaborationGateway.server.to(`diagram_${diagramId}`).emit('diagram_synced', payload);
        this.collaborationGateway.server.to(`diagram_${diagramId}`).emit('chat_message_received', chatPayload);
      }
      if (roomCode) {
        this.collaborationGateway.server.to(roomCode).emit('diagram_synced', payload);
        this.collaborationGateway.server.to(roomCode).emit('chat_message_received', chatPayload);
      }
    } catch (e) {
      this.logger.warn(`No se pudo emitir broadcast WebSocket de IA: ${e}`);
    }
  }

  private cleanAndParseJson(text: string): any {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    return JSON.parse(clean);
  }

  private sanitizeNodes(nodes: any[]): UmlClassNode[] {
    const validTypes = [
      'UUID', 'String', 'Integer', 'Long', 'Boolean', 'Double', 'Float',
      'BigDecimal', 'LocalDate', 'LocalDateTime', 'Date', 'Text', 'byte[]',
    ];

    return nodes.map((node, index) => ({
      id: node.id || `node_${Date.now()}_${index}`,
      name: node.name || `Class${index + 1}`,
      position: {
        x: node.position?.x ?? 120 + (index * 240) % 720,
        y: node.position?.y ?? 100 + Math.floor((index * 240) / 720) * 200,
      },
      width: node.width || 220,
      height: node.height || undefined,
      isAnchor: node.isAnchor || false,
      attributes: (node.attributes || []).map((attr: any) => ({
        name: attr.name || 'attr',
        type: validTypes.find((t) => t.toLowerCase() === (attr.type || '').toLowerCase()) || 'String',
      })),
      methods: (node.methods || []).map((m: any) => ({
        name: m.name || 'operation',
        parameters: m.parameters || '',
        returnType: m.returnType || 'void',
      })),
    }));
  }

  private sanitizeConnections(connections: any[], nodes: UmlClassNode[]): UmlConnection[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return connections.map((conn, index) => {
      const sourceId = conn.sourceNodeId || conn.sourceId?.replace(/_(top|bottom|left|right)$/, '');
      const targetId = conn.targetNodeId || conn.targetId?.replace(/_(top|bottom|left|right)$/, '');

      return {
        id: conn.id || `conn_${Date.now()}_${index}`,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        sourceId: conn.sourceId || `${sourceId}_right`,
        targetId: conn.targetId || `${targetId}_left`,
        type: conn.type || 'association',
        lineStyle: conn.lineStyle || 'segment',
        name: conn.name || undefined,
        sourceMultiplicity: conn.sourceMultiplicity || '',
        targetMultiplicity: conn.targetMultiplicity || '',
        assocAnchorNodeId: conn.assocAnchorNodeId || undefined,
      };
    });
  }

  private handleFallbackPrompt(
    dto: AiPromptDto,
    currentNodes: UmlClassNode[],
    currentConnections: UmlConnection[],
  ): AiResponseDto {
    const timestamp = Date.now();

    const nameMatch = dto.prompt.match(/(?:tabla|clase|entidad)\s+([A-Za-z0-9_]+)/i);
    const className = nameMatch ? nameMatch[1] : `Entidad${currentNodes.length + 1}`;

    const maxPosX = currentNodes.reduce((max, n) => Math.max(max, n.position.x + (n.width || 220)), 50);

    const newNode: UmlClassNode = {
      id: `node_${timestamp}_ai`,
      name: className,
      position: { x: maxPosX + 60, y: 80 },
      width: 220,
      attributes: [
        { name: 'id', type: 'UUID' },
        { name: 'descripcion', type: 'String' },
        { name: 'estado', type: 'Boolean' },
      ],
      methods: [
        { name: 'getId', parameters: '', returnType: 'UUID' },
      ],
    };

    const newNodes = [...currentNodes, newNode];

    return {
      success: true,
      action: 'diagram_mutated',
      message: `Se creó la clase ${className} preservando las tablas existentes.`,
      nodes: newNodes,
      connections: currentConnections,
      changesSummary: `Clase ${className} agregada al diagrama`,
    };
  }
}
