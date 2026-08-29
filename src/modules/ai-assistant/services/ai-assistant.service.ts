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
2. Si el usuario te da una instrucción estructural (ej: "crea la tabla Producto con id UUID, nombre String, precio Double y relacionala con Usuarios con multiplicidad *"), DEBES procesarla en el PRIMER INTENTO con máxima precisión técnica.
3. PRESERVACIÓN DE NODOS Y CONEXIONES EXISTENTES:
   El arreglo "nodes" y "connections" devuelto DEBE PRESERVAR TODOS los nodos y conexiones que ya existían en el diagrama ("NODOS ACTUALES"), agregando los nuevos nodos o modificando los solicitados. NUNCA descartes tablas existentes a menos que el usuario lo pida explícitamente (ej: "elimina la tabla X").
4. CREACIÓN OBLIGATORIA DE RELACIONES:
   Si el prompt menciona conectar o relacionar dos tablas (ej: "relacionala con Usuarios con multiplicidad *"), ES OBLIGATORIO generar el objeto de conexión en el arreglo "connections" referenciando los IDs correctos ("sourceNodeId" y "targetNodeId").

TIPOS DE DATOS VÁLIDOS (Backend & SQL):
- Atributos: UUID, String, Integer, Long, Boolean, Double, Float, BigDecimal, LocalDate, LocalDateTime, Date, Text, byte[]
- Métodos (Retorno): void, UUID, String, Integer, Long, Boolean, Double, BigDecimal, LocalDate, LocalDateTime, List<Object>, Object

TIPOS DE RELACIONES UML:
- association, generalization, realization, composition, aggregation, dependency, association_class

EJEMPLO DE SALIDA PARA: "Crea una tabla Producto con id UUID, nombre String, precio Double y relacionala con Usuario con multiplicidad *"
{
  "isClarificationRequired": false,
  "message": "Se creó la tabla Producto y se estableció la relación con Usuario.",
  "changesSummary": "Tabla Producto creada y conectada con Usuario (*)",
  "nodes": [
    {
      "id": "node_1",
      "name": "Usuario",
      "position": { "x": 100, "y": 80 },
      "width": 220,
      "attributes": [{ "name": "id", "type": "UUID" }],
      "methods": []
    },
    {
      "id": "node_prod_1",
      "name": "Producto",
      "position": { "x": 480, "y": 80 },
      "width": 220,
      "attributes": [
        { "name": "id", "type": "UUID" },
        { "name": "nombre", "type": "String" },
        { "name": "precio", "type": "Double" }
      ],
      "methods": [{ "name": "getId", "parameters": "", "returnType": "UUID" }]
    }
  ],
  "connections": [
    {
      "id": "conn_prod_user",
      "sourceNodeId": "node_prod_1",
      "targetNodeId": "node_1",
      "sourceId": "node_prod_1_right",
      "targetId": "node_1_left",
      "type": "association",
      "lineStyle": "segment",
      "name": "relacionado",
      "sourceMultiplicity": "*",
      "targetMultiplicity": "1"
    }
  ]
}

FORMATO DE SALIDA ESTRICTO (JSON):
Debes responder ÚNICAMENTE con un bloque JSON sin texto markdown adicional.
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

Genera el estado resultante completo del diagrama con las mutaciones aplicadas (asegurando preservar todas las tablas existentes y agregando las nuevas tablas y conexiones solicitadas).`;

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

      // Fusión inteligente y garantizada de tablas y relaciones
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
      this.broadcastAiMutation(
        dto.diagramId,
        dto.roomCode,
        finalNodes,
        finalConnections,
        parsed.changesSummary || 'Mutación estructural aplicada al diagrama',
      );

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

    // Helper para registrar nombres en singular y plural
    const registerNodeName = (name: string, node: UmlClassNode) => {
      const lower = name.toLowerCase().trim();
      nodeByNameMap.set(lower, node);
      if (lower.endsWith('s')) {
        nodeByNameMap.set(lower.slice(0, -1), node);
        nodeByNameMap.set(lower.slice(0, -2), node); // ej: "usuarios" -> "usuario"
      } else {
        nodeByNameMap.set(lower + 's', node);
        nodeByNameMap.set(lower + 'es', node);
      }
    };

    // 1. Registrar todos los nodos actuales existentes
    for (const node of currentNodes) {
      mergedNodesMap.set(node.id, { ...node });
      registerNodeName(node.name, node);
    }

    // 2. Fusionar los nodos generados por la IA
    let maxPosX = currentNodes.reduce((max, n) => Math.max(max, n.position.x + (n.width || 220)), 50);
    let maxPosY = 80;
    const newlyCreatedNodes: UmlClassNode[] = [];

    for (const aiNode of aiNodes) {
      const existingById = mergedNodesMap.get(aiNode.id);
      const existingByName = nodeByNameMap.get(aiNode.name.toLowerCase().trim());

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
          maxPosX = posX + 240;
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
        registerNodeName(newNode.name, newNode);
        newlyCreatedNodes.push(newNode);
      }
    }

    const mergedNodes = Array.from(mergedNodesMap.values());

    // 3. Fusionar conexiones existentes
    const mergedConnsMap = new Map<string, UmlConnection>();

    for (const conn of currentConnections) {
      mergedConnsMap.set(conn.id, { ...conn });
    }

    // 4. Incorporar conexiones generadas por la IA
    const resolveNode = (idOrName?: string): UmlClassNode | undefined => {
      if (!idOrName) return undefined;
      const clean = idOrName.replace(/_(top|bottom|left|right)$/, '').trim();
      return mergedNodes.find(n => n.id === clean) || nodeByNameMap.get(clean.toLowerCase());
    };

    for (const aiConn of aiConnections) {
      const sourceNode = resolveNode(aiConn.sourceNodeId || aiConn.sourceId);
      const targetNode = resolveNode(aiConn.targetNodeId || aiConn.targetId);

      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
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

    // 5. SINTETIZADOR DE RELACIONES (Garantía 100% en primer intento):
    // Si el usuario pidió relacionar/conectar tablas en el prompt y no se generó la conexión en aiConnections:
    const relationIntentMatch = prompt.match(/(?:relaciona(?:la|lo)?|conecta(?:la|lo)?|vincula(?:la|lo)?|asocia(?:la|lo)?)\s+(?:con|a)\s+([A-Za-z0-9_]+)/i);
    if (relationIntentMatch && newlyCreatedNodes.length > 0) {
      const targetName = relationIntentMatch[1];
      const targetNode = resolveNode(targetName);
      const sourceNode = newlyCreatedNodes[0];

      if (targetNode && sourceNode && targetNode.id !== sourceNode.id) {
        const alreadyConnected = Array.from(mergedConnsMap.values()).some(
          c => (c.sourceNodeId === sourceNode.id && c.targetNodeId === targetNode.id) ||
               (c.sourceNodeId === targetNode.id && c.targetNodeId === sourceNode.id)
        );

        if (!alreadyConnected) {
          // Extraer multiplicidad del prompt si existe (ej: "*" o "1..*")
          const multMatch = prompt.match(/multiplicidad\s+(?:es\s+|de\s+)?(\*|1\.\.\*|0\.\.\*|1|0\.\.1|n|m)/i);
          const mult = multMatch ? multMatch[1] : '*';

          // Extraer tipo de relación si existe (ej: composicion, agregacion, herencia)
          let relType = 'association';
          if (/composici[oó]n/i.test(prompt)) relType = 'composition';
          else if (/agregaci[oó]n/i.test(prompt)) relType = 'aggregation';
          else if (/herencia|generalizaci[oó]n/i.test(prompt)) relType = 'generalization';
          else if (/dependencia/i.test(prompt)) relType = 'dependency';

          const synthConnId = `conn_${Date.now()}_synth`;
          mergedConnsMap.set(synthConnId, {
            id: synthConnId,
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            sourceId: `${sourceNode.id}_right`,
            targetId: `${targetNode.id}_left`,
            type: relType,
            lineStyle: 'segment',
            name: 'relacionado',
            sourceMultiplicity: mult,
            targetMultiplicity: '1',
          });
        }
      }
    }

    return {
      nodes: mergedNodes,
      connections: Array.from(mergedConnsMap.values()),
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
