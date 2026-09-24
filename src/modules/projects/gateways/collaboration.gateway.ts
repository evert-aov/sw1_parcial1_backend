import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { YjsSyncService } from '../services/yjs-sync.service';
import { getAllowedCorsOrigins } from '../../../config/cors.config';
import { DiagramService } from '../../diagrams/services/diagram.service';

interface ClientMetadata {
  userId: string;
  userName: string;
  diagramId: string;
  roomCode: string;
  sessionId?: string;
  color: string;
}

export interface NodeLockInfo {
  nodeId: string;
  userId: string;
  userName: string;
  color: string;
  diagramId: string;
  lockedAt: number;
}

@WebSocketGateway({
  namespace: '/collaboration',
  pingInterval: 5000,
  pingTimeout: 5000,
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = getAllowedCorsOrigins();
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  },
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly clientMap = new Map<string, ClientMetadata>();
  // Mapa de bloqueo de nodos por exclusión mutua: `${diagramId}_${nodeId}` => NodeLockInfo
  private readonly nodeLocks = new Map<string, NodeLockInfo>();

  // Mecanismo de persistencia y auto-guardado en tiempo real estilo Google Docs
  private readonly autoSaveTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingAutoSaves = new Map<
    string,
    { nodes: any[]; connections: any[]; userId?: string; roomCode?: string; lineStyle?: string }
  >();

  constructor(
    private readonly yjsSyncService: YjsSyncService,
    @Optional()
    @Inject(forwardRef(() => DiagramService))
    private readonly diagramService?: DiagramService,
  ) { }

  handleConnection(client: Socket): void {
    this.logger.log(`[WebSocket] Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    await this.processClientDeparture(client);
  }

  private async processClientDeparture(
    client: Socket,
    fallback?: { diagramId?: string; roomCode?: string; userId?: string; sessionId?: string },
  ): Promise<void> {
    const meta = this.clientMap.get(client.id);
    const userId = meta?.userId || fallback?.userId;
    const diagramId = meta?.diagramId || fallback?.diagramId;
    const roomCode = meta?.roomCode || fallback?.roomCode;
    const sessionId = meta?.sessionId || fallback?.sessionId;
    const userName = meta?.userName || 'Colaborador';

    if (!userId && !diagramId && !roomCode) {
      this.clientMap.delete(client.id);
      return;
    }

    this.logger.log(
      `[WebSocket] Cliente ${userName} (${userId}) abandonó o desconectó de sala: ${roomCode || diagramId}`,
    );

    // Persistir de inmediato cualquier cambio pendiente de guardado para este diagrama
    if (diagramId && this.pendingAutoSaves.has(diagramId)) {
      await this.flushAutoSave(diagramId);
    }

    if (sessionId && userId) {
      try {
        await this.yjsSyncService.leaveSession(sessionId, userId);
      } catch (err) {
        this.logger.warn(`Error al abandonar sesión Yjs: ${err}`);
      }
    }

    // Liberar cualquier bloqueo de tabla/nodo que tuviera este usuario
    if (userId && diagramId) {
      const locksToRelease: string[] = [];
      for (const [lockKey, lockInfo] of this.nodeLocks.entries()) {
        if (lockInfo.userId === userId && lockInfo.diagramId === diagramId) {
          locksToRelease.push(lockKey);
          const unlockPayload = {
            nodeId: lockInfo.nodeId,
            userId,
          };
          if (roomCode) {
            this.server.to(roomCode).emit('node_unlocked', unlockPayload);
          }
          if (diagramId) {
            this.server.to(`diagram_${diagramId}`).emit('node_unlocked', unlockPayload);
          }
        }
      }
      for (const key of locksToRelease) {
        this.nodeLocks.delete(key);
      }
    }

    // Remover del mapa antes de recalcular
    this.clientMap.delete(client.id);

    // Salir de salas del socket si sigue conectado
    if (roomCode) {
      try {
        client.leave(roomCode);
      } catch (_) {}
    }
    if (diagramId) {
      try {
        client.leave(`diagram_${diagramId}`);
      } catch (_) {}
    }

    // Calcular lista actualizada de participantes activos para este diagrama / sala
    const connectedClients = Array.from(this.clientMap.values()).filter(
      (c) => (diagramId && c.diagramId === diagramId) || (roomCode && c.roomCode === roomCode),
    );

    const uniqueParticipants = Array.from(
      new Map(
        connectedClients.map((c) => [
          c.userId,
          {
            userId: c.userId,
            userName: c.userName,
            color: c.color,
            isConnected: true,
          },
        ]),
      ).values(),
    );

    const departurePayload = {
      userId,
      userName,
      socketId: client.id,
    };

    const participantsPayload = {
      diagramId,
      roomCode,
      participants: uniqueParticipants,
    };

    if (roomCode) {
      this.server.to(roomCode).emit('user_left', departurePayload);
      this.server.to(roomCode).emit('room_participants_updated', participantsPayload);
    }
    if (diagramId) {
      this.server.to(`diagram_${diagramId}`).emit('user_left', departurePayload);
      this.server.to(`diagram_${diagramId}`).emit('room_participants_updated', participantsPayload);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody()
    data: {
      diagramId: string;
      roomCode?: string;
      userId: string;
      userName: string;
      color?: string;
    },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; session: any; participants: any[]; activeLocks: any[] }> {
    try {
      // Validar que el diagramId sea un UUID válido antes de consultar la BD
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!data.diagramId || !uuidRegex.test(data.diagramId)) {
        this.logger.warn(`[WebSocket] join_room ignorado: diagramId inválido "${data.diagramId}" (no es UUID)`);
        return { success: false, session: null, participants: [], activeLocks: [] };
      }

      this.logger.log(
        `[WebSocket] join_room recibido de ${data.userName} (${data.userId}) para diagrama ${data.diagramId}`,
      );

      const session = await this.yjsSyncService.joinOrCreateSession(
        {
          diagramId: data.diagramId,
          roomCode: data.roomCode,
          cursorColor: data.color,
        },
        data.userId,
      );

      const targetRoom = session.roomCode;
      const diagramRoom = `diagram_${data.diagramId}`;

      // Unir socket a ambas salas (código de sala y diagrama)
      await client.join(targetRoom);
      await client.join(diagramRoom);

      const color = data.color || '#007ACC';

      this.clientMap.set(client.id, {
        userId: data.userId,
        userName: data.userName,
        diagramId: data.diagramId,
        roomCode: targetRoom,
        sessionId: session.id,
        color,
      });

      // Obtener participantes únicos conectados
      const connectedClients = Array.from(this.clientMap.values()).filter(
        (c) => c.diagramId === data.diagramId || c.roomCode === targetRoom,
      );

      const uniqueParticipants = Array.from(
        new Map(connectedClients.map((c) => [c.userId, {
          userId: c.userId,
          userName: c.userName,
          color: c.color,
          isConnected: true,
        }])).values()
      );

      // Obtener bloqueos activos en este diagrama
      const currentLocks = Array.from(this.nodeLocks.values())
        .filter((l) => l.diagramId === data.diagramId)
        .map((l) => ({
          nodeId: l.nodeId,
          userId: l.userId,
          userName: l.userName,
          color: l.color,
        }));

      // Notificar a todos los miembros de la sala
      this.server.to(targetRoom).to(diagramRoom).emit('room_participants_updated', {
        diagramId: data.diagramId,
        roomCode: targetRoom,
        participants: uniqueParticipants,
      });

      client.to(targetRoom).to(diagramRoom).emit('user_joined', {
        userId: data.userId,
        userName: data.userName,
        color,
        socketId: client.id,
      });

      return {
        success: true,
        session,
        participants: uniqueParticipants,
        activeLocks: currentLocks,
      };
    } catch (err) {
      this.logger.error(`Error en handleJoinRoom: ${err}`);
      return {
        success: false,
        session: null,
        participants: [],
        activeLocks: [],
      };
    }
  }

  @SubscribeMessage('lock_node')
  handleLockNode(
    @MessageBody()
    data: {
      diagramId: string;
      roomCode?: string;
      nodeId: string;
      userId: string;
      userName: string;
      color?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const lockKey = `${data.diagramId}_${data.nodeId}`;
    const existing = this.nodeLocks.get(lockKey);

    if (existing && existing.userId !== data.userId) {
      this.logger.warn(
        `[WebSocket] Rechazado bloqueo en nodo ${data.nodeId}: ya bloqueado por ${existing.userName}`,
      );
      client.emit('node_lock_rejected', {
        nodeId: data.nodeId,
        lockedBy: {
          userId: existing.userId,
          userName: existing.userName,
          color: existing.color,
        },
      });
      return;
    }

    const lockInfo: NodeLockInfo = {
      nodeId: data.nodeId,
      userId: data.userId,
      userName: data.userName,
      color: data.color || '#007ACC',
      diagramId: data.diagramId,
      lockedAt: Date.now(),
    };

    this.nodeLocks.set(lockKey, lockInfo);
    this.logger.log(
      `[WebSocket] Nodo ${data.nodeId} bloqueado con exclusión mutua por ${data.userName}`,
    );

    const broadcastPayload = {
      nodeId: data.nodeId,
      userId: data.userId,
      userName: data.userName,
      color: lockInfo.color,
    };

    if (data.diagramId) {
      client.to(`diagram_${data.diagramId}`).emit('node_locked', broadcastPayload);
    }
    if (data.roomCode) {
      client.to(data.roomCode).emit('node_locked', broadcastPayload);
    }
  }

  @SubscribeMessage('unlock_node')
  handleUnlockNode(
    @MessageBody()
    data: {
      diagramId: string;
      roomCode?: string;
      nodeId: string;
      userId: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const lockKey = `${data.diagramId}_${data.nodeId}`;
    this.nodeLocks.delete(lockKey);

    this.logger.log(`[WebSocket] Nodo ${data.nodeId} desbloqueado`);

    const broadcastPayload = {
      nodeId: data.nodeId,
      userId: data.userId,
    };

    if (data.diagramId) {
      this.server.to(`diagram_${data.diagramId}`).emit('node_unlocked', broadcastPayload);
    }
    if (data.roomCode) {
      this.server.to(data.roomCode).emit('node_unlocked', broadcastPayload);
    }
  }

  // --- MÉTODOS PÚBLICOS DE BLOQUEO PARA COPILOT IA ---
  lockNodeForAi(
    diagramId: string,
    roomCode: string | undefined,
    nodeId: string,
    userName = '✨ Copilot IA',
    color = '#8B5CF6',
  ): void {
    try {
      if (!this.server) return;
      const lockKey = `${diagramId}_${nodeId}`;
      const lockInfo: NodeLockInfo = {
        nodeId,
        userId: 'ai_copilot_vertex',
        userName,
        color,
        diagramId,
        lockedAt: Date.now(),
      };
      this.nodeLocks.set(lockKey, lockInfo);

      const broadcastPayload = {
        nodeId,
        userId: 'ai_copilot_vertex',
        userName,
        color,
      };

      if (diagramId) {
        this.server.to(`diagram_${diagramId}`).emit('node_locked', broadcastPayload);
      }
      if (roomCode) {
        this.server.to(roomCode).emit('node_locked', broadcastPayload);
      }
    } catch (e) {
      this.logger.warn(`No se pudo bloquear nodo para IA: ${e}`);
    }
  }

  unlockNodeForAi(
    diagramId: string,
    roomCode: string | undefined,
    nodeId: string,
  ): void {
    try {
      if (!this.server) return;
      const lockKey = `${diagramId}_${nodeId}`;
      this.nodeLocks.delete(lockKey);

      const broadcastPayload = {
        nodeId,
        userId: 'ai_copilot_vertex',
      };

      if (diagramId) {
        this.server.to(`diagram_${diagramId}`).emit('node_unlocked', broadcastPayload);
      }
      if (roomCode) {
        this.server.to(roomCode).emit('node_unlocked', broadcastPayload);
      }
    } catch (e) {
      this.logger.warn(`No se pudo desbloquear nodo para IA: ${e}`);
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody()
    data: { diagramId?: string; roomCode?: string; userId?: string; sessionId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    await this.processClientDeparture(client, data);
    return { success: true };
  }

  @SubscribeMessage('cursor_move')
  handleCursorMove(
    @MessageBody()
    data: {
      diagramId?: string;
      roomCode?: string;
      userId: string;
      userName: string;
      x: number;
      y: number;
      color?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const payload = {
      userId: data.userId,
      userName: data.userName,
      x: data.x,
      y: data.y,
      color: data.color || '#007ACC',
    };

    if (data.diagramId) {
      client.to(`diagram_${data.diagramId}`).emit('cursor_moved', payload);
    }
    if (data.roomCode) {
      client.to(data.roomCode).emit('cursor_moved', payload);
    }
  }

  @SubscribeMessage('node_drag')
  handleNodeDrag(
    @MessageBody()
    data: {
      diagramId?: string;
      roomCode?: string;
      nodeId: string;
      position: { x: number; y: number };
      userId: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const payload = {
      nodeId: data.nodeId,
      position: data.position,
      userId: data.userId,
    };

    if (data.diagramId) {
      client.to(`diagram_${data.diagramId}`).emit('node_dragged', payload);
    }
    if (data.roomCode) {
      client.to(data.roomCode).emit('node_dragged', payload);
    }
  }

  @SubscribeMessage('diagram_sync')
  handleDiagramSync(
    @MessageBody()
    data: {
      diagramId?: string;
      roomCode?: string;
      nodes: any[];
      connections: any[];
      userId: string;
      action?: string;
      defaultLineStyle?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const payload = {
      nodes: data.nodes,
      connections: data.connections,
      userId: data.userId,
      action: data.action || 'update',
      defaultLineStyle: data.defaultLineStyle,
    };

    if (data.diagramId) {
      client.to(`diagram_${data.diagramId}`).emit('diagram_synced', payload);
    }
    if (data.roomCode) {
      client.to(data.roomCode).emit('diagram_synced', payload);
    }

    // Auto-guardado en base de datos en tiempo real (Google Docs style)
    if (data.diagramId && data.nodes) {
      this.scheduleAutoSave(
        data.diagramId,
        data.nodes,
        data.connections || [],
        data.userId,
        data.roomCode,
        data.defaultLineStyle,
      );
    }
  }

  /**
   * Mapea nodos y conexiones arbitrarios del frontend al DTO formal esperado por DiagramService
   */
  private mapToSaveAstDto(nodes: any[], connections: any[], defaultLineStyle = 'segment') {
    return {
      defaultLineStyle: defaultLineStyle || 'segment',
      nodes: (nodes || []).map((n) => ({
        id: String(n.id),
        name: n.isAnchor ? (n.name || 'Anchor') : (n.name || 'ClassName'),
        positionX: Number(n.position?.x ?? n.positionX ?? 0),
        positionY: Number(n.position?.y ?? n.positionY ?? 0),
        width: Number(n.width ?? (n.isAnchor ? 0 : 220)),
        height: n.height ? Number(n.height) : null,
        isAnchor: !!n.isAnchor,
        assocMainConnId: n.assocMainConnId || null,
        attributes: (n.attributes || []).map((a: any, idx: number) => ({
          name: String(a.name || 'attr'),
          type: String(a.type || 'String'),
          orderIndex: a.orderIndex !== undefined ? Number(a.orderIndex) : idx,
        })),
        methods: (n.methods || []).map((m: any, idx: number) => ({
          name: String(m.name || 'method'),
          parameters: String(m.parameters ?? ''),
          returnType: String(m.returnType || 'void'),
          orderIndex: m.orderIndex !== undefined ? Number(m.orderIndex) : idx,
        })),
      })),
      connections: (connections || []).map((c) => {
        const baseSourceId =
          c.sourceNodeId ||
          (c.sourceId ? String(c.sourceId).replace(/_(top|bottom|left|right)$/, '') : '');
        const baseTargetId =
          c.targetNodeId ||
          (c.targetId ? String(c.targetId).replace(/_(top|bottom|left|right)$/, '') : '');
        return {
          id: String(c.id),
          sourceNodeId: baseSourceId,
          targetNodeId: baseTargetId,
          sourceId: c.sourceId || baseSourceId,
          targetId: c.targetId || baseTargetId,
          type: c.type || 'ASSOCIATION',
          lineStyle: c.lineStyle || defaultLineStyle || 'segment',
          name: c.name || null,
          sourceMultiplicity: c.sourceMultiplicity || '',
          targetMultiplicity: c.targetMultiplicity || '',
          assocAnchorNodeId: c.assocAnchorNodeId || null,
        };
      }),
    };
  }

  /**
   * Ejecuta inmediatamente el guardado pendiente en BD y notifica a los clientes
   */
  async flushAutoSave(diagramId: string): Promise<void> {
    const timer = this.autoSaveTimers.get(diagramId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(diagramId);
    }

    const pending = this.pendingAutoSaves.get(diagramId);
    if (!pending || !this.diagramService) {
      return;
    }
    this.pendingAutoSaves.delete(diagramId);

    try {
      const astDto = this.mapToSaveAstDto(pending.nodes, pending.connections, pending.lineStyle);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validUserId = pending.userId && uuidRegex.test(pending.userId) ? pending.userId : undefined;

      await this.diagramService.saveAst(diagramId, astDto, validUserId);
      this.logger.log(`[AutoSave] Diagrama ${diagramId} persistido exitosamente en PostgreSQL.`);

      const savePayload = {
        diagramId,
        savedAt: new Date().toISOString(),
      };

      if (pending.roomCode) {
        this.server.to(pending.roomCode).emit('diagram_saved', savePayload);
      }
      this.server.to(`diagram_${diagramId}`).emit('diagram_saved', savePayload);
    } catch (err) {
      this.logger.error(`[AutoSave] Error al auto-guardar diagrama ${diagramId}: ${err}`);
    }
  }

  /**
   * Programa un auto-guardado en base de datos con debounce de 1000ms
   */
  scheduleAutoSave(
    diagramId: string,
    nodes: any[],
    connections: any[],
    userId?: string,
    roomCode?: string,
    lineStyle?: string,
  ): void {
    if (!this.diagramService) return;

    this.pendingAutoSaves.set(diagramId, { nodes, connections, userId, roomCode, lineStyle });

    const existingTimer = this.autoSaveTimers.get(diagramId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.autoSaveTimers.delete(diagramId);
      this.flushAutoSave(diagramId);
    }, 1000);

    this.autoSaveTimers.set(diagramId, timer);
  }

  @SubscribeMessage('chat_message')
  handleChatMessage(
    @MessageBody()
    data: {
      diagramId?: string;
      roomCode?: string;
      userId: string;
      userName: string;
      message: string;
    },
  ): void {
    const payload = {
      userId: data.userId,
      userName: data.userName,
      message: data.message,
      timestamp: new Date().toISOString(),
    };

    if (data.diagramId) {
      this.server.to(`diagram_${data.diagramId}`).emit('chat_message_received', payload);
    }
    if (data.roomCode) {
      this.server.to(data.roomCode).emit('chat_message_received', payload);
    }
  }

  /**
   * Retorna la lista de usuarios únicos conectados a la sala de un diagrama.
   */
  getActiveUsersForDiagram(diagramId: string): Array<{ userId: string; userName: string }> {
    const clients = Array.from(this.clientMap.values()).filter(
      (c) => c.diagramId === diagramId,
    );
    const uniqueUsers = new Map<string, { userId: string; userName: string }>();
    for (const c of clients) {
      if (c.userId) {
        uniqueUsers.set(c.userId, { userId: c.userId, userName: c.userName });
      }
    }
    return Array.from(uniqueUsers.values());
  }

  /**
   * Retorna el número de usuarios únicos conectados editando el diagrama.
   */
  getActiveUserCount(diagramId: string): number {
    return this.getActiveUsersForDiagram(diagramId).length;
  }
}

