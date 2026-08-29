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
import { Logger } from '@nestjs/common';
import { YjsSyncService } from '../services/yjs-sync.service';

interface ClientMetadata {
  userId: string;
  userName: string;
  diagramId: string;
  roomCode: string;
  sessionId?: string;
  color: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/collaboration',
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly clientMap = new Map<string, ClientMetadata>();

  constructor(private readonly yjsSyncService: YjsSyncService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`[WebSocket] Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const meta = this.clientMap.get(client.id);
    if (meta) {
      this.logger.log(
        `[WebSocket] Cliente ${meta.userName} (${meta.userId}) desconectado de sala ${meta.roomCode}`,
      );

      if (meta.sessionId) {
        await this.yjsSyncService.leaveSession(meta.sessionId, meta.userId);
      }

      this.clientMap.delete(client.id);

      // Calcular lista actualizada de participantes activos para este diagrama
      const connectedClients = Array.from(this.clientMap.values()).filter(
        (c) => c.diagramId === meta.diagramId || c.roomCode === meta.roomCode,
      );

      const uniqueParticipants = Array.from(
        new Map(connectedClients.map((c) => [c.userId, {
          userId: c.userId,
          userName: c.userName,
          color: c.color,
          isConnected: true,
        }])).values()
      );

      this.server.to(meta.roomCode).to(`diagram_${meta.diagramId}`).emit('user_left', {
        userId: meta.userId,
        userName: meta.userName,
        socketId: client.id,
      });

      this.server.to(meta.roomCode).to(`diagram_${meta.diagramId}`).emit('room_participants_updated', {
        diagramId: meta.diagramId,
        roomCode: meta.roomCode,
        participants: uniqueParticipants,
      });
    } else {
      this.clientMap.delete(client.id);
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
  ): Promise<{ success: boolean; session: any; participants: any[] }> {
    try {
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

      this.logger.log(
        `[WebSocket] Participantes activos en diagrama ${data.diagramId}: ${uniqueParticipants.map((p) => p.userName).join(', ')}`,
      );

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
      };
    } catch (err) {
      this.logger.error(`Error en handleJoinRoom: ${err}`);
      return {
        success: false,
        session: null,
        participants: [],
      };
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { diagramId?: string; roomCode?: string; userId: string; sessionId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    if (data.roomCode) client.leave(data.roomCode);
    if (data.diagramId) client.leave(`diagram_${data.diagramId}`);

    if (data.sessionId && data.userId) {
      await this.yjsSyncService.leaveSession(data.sessionId, data.userId);
    }

    this.clientMap.delete(client.id);
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
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const payload = {
      nodes: data.nodes,
      connections: data.connections,
      userId: data.userId,
      action: data.action || 'update',
    };

    if (data.diagramId) {
      client.to(`diagram_${data.diagramId}`).emit('diagram_synced', payload);
    }
    if (data.roomCode) {
      client.to(data.roomCode).emit('diagram_synced', payload);
    }
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
}
