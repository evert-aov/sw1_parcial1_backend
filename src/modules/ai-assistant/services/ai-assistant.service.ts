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
Tu función es interpretar comandos de creación, modificación, eliminación y generación de diagramas de clases UML y emitir el Árbol de Sintaxis Abstracta (AST) en formato JSON.

REGLAS DE ORO / GUARDRAILS:
1. CRITERIO DE CLARIDAD vs ACLARACIÓN:
   - SI EL PROMPT CONTIENE ESPECIFICACIONES CONCRETAS (listas de tablas, atributos, tipos de datos, relaciones, multiplicidades, o comandos como "elimina tabla X", "cambia tipo de Y a Z en tabla W", o un esquema con "1. Tablas y Atributos..."):
     DEBES RESPONDER OBLIGATORIAMENTE CON "isClarificationRequired": false Y APLICAR LA MUTACIÓN O GENERACIÓN COMPLETA.
   - ÚNICAMENTE debes responder "isClarificationRequired": true si el usuario solo envía un saludo vacío o una frase sin ninguna entidad ni acción técnica (ej: "hola qué tal" o "ayúdame con mi tarea").
   - SIEMPRE que respondas con "isClarificationRequired": true, incluye en "message" una guía amable explicando qué tablas o campos requiere indicar.

2. SOPORTE DE OPERACIONES CRUD COMPLETAS:
   - CREACIÓN: Generar nuevas clases con posiciones (x, y) en cuadrícula y atributos tipados.
   - ELIMINACIÓN DE TABLAS: Si el usuario pide eliminar una tabla (ej: "elimina la tabla Detalle de compra" o "borra Usuario"), quita dicha tabla de "nodes" y todas sus conexiones de "connections".
   - ELIMINACIÓN DE ATRIBUTOS: Si pide quitar un atributo de una tabla, remuévelo de la lista de attributes de esa clase.
   - MODIFICACIÓN DE ATRIBUTOS: Si pide renombrar un atributo o cambiar su tipo (ej: de Double a BigDecimal), actualízalo en la clase correspondiente.
   - GENERACIÓN INTEGRAL DE ESQUEMAS: Si el usuario envía un esquema completo con tablas y relaciones, genéralo íntegro con todas sus clases y multiplicidades.

3. TOLERANCIA Y MATCHING FLEXIBLE DE NOMBRES:
   - Interpreta variaciones en lenguaje natural: "Detalles de compra" / "Detalle de compras" / "DetalleCompra" / "detalle_compra" refieren a la misma entidad.
   - Adapta tipos comunes: "int" -> "Integer", "DateTime" -> "LocalDateTime", "text" -> "Text", "bool" -> "Boolean".

TIPOS DE DATOS VÁLIDOS (Backend & SQL):
- Atributos: UUID, String, Integer, Long, Boolean, Double, Float, BigDecimal, LocalDate, LocalDateTime, Date, Text, byte[]
- Métodos (Retorno): void, UUID, String, Integer, Long, Boolean, Double, BigDecimal, LocalDate, LocalDateTime, List<Object>, Object

TIPOS DE RELACIONES UML:
- association, generalization, realization, composition, aggregation, dependency, association_class

FORMATO DE SALIDA ESTRICTO (JSON):
Debes responder ÚNICAMENTE con un bloque JSON sin texto markdown adicional:
{
  "isClarificationRequired": false,
  "message": "Descripción concisa de las operaciones realizadas",
  "changesSummary": "Resumen de las mutaciones aplicadas",
  "nodes": [
    {
      "id": "node_1",
      "name": "NombreClase",
      "position": { "x": 100, "y": 80 },
      "width": 220,
      "attributes": [{ "name": "id", "type": "UUID" }],
      "methods": [{ "name": "getId", "parameters": "", "returnType": "UUID" }]
    }
  ],
  "connections": [
    {
      "id": "conn_1",
      "sourceNodeId": "node_1",
      "targetNodeId": "node_2",
      "sourceId": "node_1_right",
      "targetId": "node_2_left",
      "type": "association",
      "lineStyle": "segment",
      "name": "relacion",
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

  // Normalizador de texto palabra por palabra para matching difuso
  normalizeForFuzzy(text: string): string {
    if (!text) return '';

    // Separar CamelCase (ej: "DetalleCompra" -> "Detalle Compra")
    const spacedCamel = text.replace(/([a-z])([A-Z])/g, '$1 $2');

    const stopwords = new Set([
      'de', 'la', 'el', 'los', 'las', 'del', 'un', 'una', 'unos', 'unas',
      'tabla', 'tablas', 'clase', 'clases', 'entidad', 'entidades', 'nodo', 'nodos'
    ]);

    const words = spacedCamel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/);

    const stemmedWords = words
      .filter(w => w.length > 0 && !stopwords.has(w))
      .map(w => {
        if (/[aeiou]s$/i.test(w) && w.length > 3) return w.slice(0, -1);
        if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
        return w;
      });

    return stemmedWords.join('');
  }

  // Buscar un nodo por nombre exacto o aproximado
  findNodeFuzzy(nodes: UmlClassNode[], query: string): UmlClassNode | undefined {
    if (!query) return undefined;
    const cleanQuery = this.normalizeForFuzzy(query);
    if (!cleanQuery) return undefined;

    // 1. Coincidencia por ID
    const byId = nodes.find(n => n.id.toLowerCase() === query.toLowerCase().trim());
    if (byId) return byId;

    // 2. Coincidencia exacta normalizada
    const byNormalized = nodes.find(n => this.normalizeForFuzzy(n.name) === cleanQuery);
    if (byNormalized) return byNormalized;

    // 3. Coincidencia por inclusión / prefijo / sufijo
    return nodes.find(n => {
      const nodeNorm = this.normalizeForFuzzy(n.name);
      return nodeNorm.includes(cleanQuery) || cleanQuery.includes(nodeNorm);
    });
  }

  async processTextPrompt(dto: AiPromptDto): Promise<AiResponseDto> {
    const currentNodes: UmlClassNode[] = dto.currentNodes || [];
    const currentConnections: UmlConnection[] = dto.currentConnections || [];
    const prompt = dto.prompt.trim();

    // 1. CHEQUEO LOCAL INMEDIATO DE ELIMINACIÓN DE ATRIBUTO
    const deleteAttrMatch = prompt.match(/(?:elimina|borra|quita|delete|remove)\s+(?:el\s+atributo|el\s+campo|la\s+columna|atributo|campo|columna)?\s*([A-Za-z0-9_]+)\s+(?:de|en|desde)\s+(?:la\s+tabla|la\s+clase|tabla|clase)?\s*([A-Za-z0-9_\s]+)/i);
    if (deleteAttrMatch && !prompt.includes('\n') && prompt.length < 90) {
      const attrName = deleteAttrMatch[1].trim();
      const targetQuery = deleteAttrMatch[2];
      const targetNode = this.findNodeFuzzy(currentNodes, targetQuery);

      if (targetNode) {
        const updatedNodes = currentNodes.map(n => {
          if (n.id === targetNode.id) {
            return {
              ...n,
              attributes: (n.attributes || []).filter(a => a.name.toLowerCase() !== attrName.toLowerCase())
            };
          }
          return n;
        });

        this.broadcastAiMutation(
          dto.diagramId,
          dto.roomCode,
          updatedNodes,
          currentConnections,
          `Atributo ${attrName} eliminado de ${targetNode.name}`,
        );

        return {
          success: true,
          action: 'diagram_mutated',
          message: `Se eliminó el atributo "${attrName}" de la tabla "${targetNode.name}".`,
          nodes: updatedNodes,
          connections: currentConnections,
          changesSummary: `Atributo ${attrName} eliminado de ${targetNode.name}`,
        };
      }
    }

    // 2. CHEQUEO LOCAL INMEDIATO DE ELIMINACIÓN DE TABLA
    const isAttrOperation = /(?:atributo|campo|columna)/i.test(prompt);
    const deleteTableMatch = prompt.match(/(?:elimina|borra|quita|delete|remove)\s+(?:la\s+tabla|la\s+clase|el\s+nodo|la\s+entidad|tabla|clase)?\s*(?:de\s+)?([A-Za-z0-9_\s]+)/i);
    if (!isAttrOperation && deleteTableMatch && !prompt.includes('\n') && prompt.length < 90) {
      const targetQuery = deleteTableMatch[1];
      const targetNode = this.findNodeFuzzy(currentNodes, targetQuery);

      if (targetNode) {
        const remainingNodes = currentNodes.filter(n => n.id !== targetNode.id && n.assocAnchorNodeId !== targetNode.id);
        const remainingConnections = currentConnections.filter(
          c => c.sourceNodeId !== targetNode.id && c.targetNodeId !== targetNode.id &&
               !c.sourceId.startsWith(targetNode.id) && !c.targetId.startsWith(targetNode.id)
        );

        this.broadcastAiMutation(
          dto.diagramId,
          dto.roomCode,
          remainingNodes,
          remainingConnections,
          `Tabla ${targetNode.name} eliminada del diagrama`,
        );

        return {
          success: true,
          action: 'diagram_mutated',
          message: `Se eliminó exitosamente la tabla "${targetNode.name}" y sus conexiones asociadas.`,
          nodes: remainingNodes,
          connections: remainingConnections,
          changesSummary: `Tabla ${targetNode.name} eliminada`,
        };
      }
    }

    // 3. PROCESAMIENTO MEDIANTE VERTEX AI GEMINI 2.5 FLASH
    const userContent = `
ESTADO ACTUAL DEL DIAGRAMA:
NODOS ACTUALES (${currentNodes.length}):
${JSON.stringify(currentNodes, null, 2)}

CONEXIONES ACTUALES (${currentConnections.length}):
${JSON.stringify(currentConnections, null, 2)}

INSTRUCCIÓN DEL USUARIO:
"${prompt}"

Aplica las mutaciones solicitadas sobre el diagrama (crear, modificar, eliminar tablas/atributos/relaciones o generar el esquema completo) y devuelve el JSON resultante.`;

    try {
      const responseText = await this.vertexAiService.generateContent({
        systemInstruction: UML_SYSTEM_INSTRUCTION,
        contents: userContent,
        responseMimeType: 'application/json',
      });

      const parsed = this.cleanAndParseJson(responseText);

      // Si el usuario dio especificaciones técnicas claras, forzar éxito
      const hasStructuralSpecs = /(?:tablas?|atributos?|relaciones?|multiplicidad|uuid|string|integer|double|fecha|clase|\:|\-)/i.test(prompt);

      if (parsed.isClarificationRequired && !hasStructuralSpecs) {
        const clarificationMsg = parsed.message || parsed.reason || parsed.explanation || parsed.details ||
          'Por favor especifica las tablas, atributos o relaciones concretas que requieres para el diagrama (ej: nombres de clases, campos y tipos de datos), o adjunta una imagen del diagrama.';

        return {
          success: false,
          action: 'clarification_required',
          message: clarificationMsg,
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
        prompt,
      );

      const finalNodes = this.sanitizeNodes(merged.nodes);
      const finalConnections = this.sanitizeConnections(merged.connections, finalNodes);

      this.broadcastAiMutation(
        dto.diagramId,
        dto.roomCode,
        finalNodes,
        finalConnections,
        parsed.changesSummary || 'Mutación estructural aplicada al diagrama',
      );

      const successMsg = parsed.message || parsed.changesSummary || 'Diagrama actualizado exitosamente por Copilot IA.';

      return {
        success: true,
        action: 'diagram_mutated',
        message: successMsg,
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
    // Si el prompt es una generación completa desde cero con múltiples tablas
    const isFullGeneration = prompt.includes('1. Tablas y Atributos') || (aiNodes.length >= 3 && currentNodes.length <= 2);

    const mergedNodesMap = new Map<string, UmlClassNode>();

    if (isFullGeneration && aiNodes.length > 0) {
      // Reemplazo completo si es un esquema nuevo completo
      for (const node of aiNodes) {
        mergedNodesMap.set(node.id || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, { ...node });
      }
    } else {
      // Fusión preservando nodos actuales
      for (const node of currentNodes) {
        mergedNodesMap.set(node.id, { ...node });
      }

      let maxPosX = currentNodes.reduce((max, n) => Math.max(max, n.position.x + (n.width || 220)), 50);
      let maxPosY = 80;

      for (const aiNode of aiNodes) {
        const existingNode = this.findNodeFuzzy(Array.from(mergedNodesMap.values()), aiNode.name);

        if (existingNode) {
          // Actualizar atributos y métodos de la tabla existente
          mergedNodesMap.set(existingNode.id, {
            ...existingNode,
            name: aiNode.name || existingNode.name,
            attributes: (aiNode.attributes && aiNode.attributes.length > 0) ? aiNode.attributes : existingNode.attributes,
            methods: (aiNode.methods && aiNode.methods.length > 0) ? aiNode.methods : existingNode.methods,
          });
        } else {
          // Nuevo nodo en posición libre
          const newId = aiNode.id && !aiNode.id.startsWith('node_xxx') ? aiNode.id : `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          let posX = aiNode.position?.x;
          let posY = aiNode.position?.y;

          if (posX === undefined || posX < 50) {
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
        }
      }
    }

    const mergedNodes = Array.from(mergedNodesMap.values());

    // Fusión de conexiones
    const mergedConnsMap = new Map<string, UmlConnection>();

    if (!isFullGeneration) {
      for (const conn of currentConnections) {
        mergedConnsMap.set(conn.id, { ...conn });
      }
    }

    const resolveNode = (idOrName?: string): UmlClassNode | undefined => {
      if (!idOrName) return undefined;
      const clean = idOrName.replace(/_(top|bottom|left|right)$/, '').trim();
      return mergedNodes.find(n => n.id === clean) || this.findNodeFuzzy(mergedNodes, clean);
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

    const normalizeType = (raw: string): string => {
      if (!raw) return 'String';
      const clean = raw.trim().toLowerCase();
      if (clean === 'int') return 'Integer';
      if (clean === 'datetime') return 'LocalDateTime';
      if (clean === 'bool') return 'Boolean';
      if (clean === 'number') return 'Double';
      return validTypes.find(t => t.toLowerCase() === clean) || 'String';
    };

    return nodes.map((node, index) => ({
      id: node.id || `node_${Date.now()}_${index}`,
      name: node.name || `Class${index + 1}`,
      position: {
        x: node.position?.x ?? 120 + (index * 260) % 780,
        y: node.position?.y ?? 80 + Math.floor((index * 260) / 780) * 220,
      },
      width: node.width || 220,
      height: node.height || undefined,
      isAnchor: node.isAnchor || false,
      attributes: (node.attributes || []).map((attr: any) => ({
        name: attr.name || 'attr',
        type: normalizeType(attr.type),
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

    return connections
      .map((conn, index) => {
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
      })
      .filter(conn => nodeMap.has(conn.sourceNodeId || '') && nodeMap.has(conn.targetNodeId || ''));
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
      message: `Se procesó la instrucción sobre ${className}.`,
      nodes: newNodes,
      connections: currentConnections,
      changesSummary: `Operación aplicada sobre ${className}`,
    };
  }
}
