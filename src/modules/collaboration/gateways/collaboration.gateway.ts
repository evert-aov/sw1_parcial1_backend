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
  userId?: string;
  userName?: string;
  roomCode?: string;
  sessionId?: string;
  color?: string;
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
    this.logger.log(`Cliente WebSocket conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const meta = this.clientMap.get(client.id);
    if (meta && meta.roomCode && meta.userId) {
      this.logger.log(
        `Cliente ${meta.userName || meta.userId} desconectado de sala ${meta.roomCode}`,
      );

      if (meta.sessionId) {
        await this.yjsSyncService.leaveSession(meta.sessionId, meta.userId);
      }

      this.server.to(meta.roomCode).emit('user_left', {
        userId: meta.userId,
        userName: meta.userName,
        socketId: client.id,
      });
    }

    this.clientMap.delete(client.id);
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
  ): Promise<{ success: boolean; session: any }> {
    try {
      const session = await this.yjsSyncService.joinOrCreateSession(
        {
          diagramId: data.diagramId,
          roomCode: data.roomCode,
          cursorColor: data.color,
        },
        data.userId,
      );

      const targetRoom = session.roomCode;
      await client.join(targetRoom);

      this.clientMap.set(client.id, {
        userId: data.userId,
        userName: data.userName,
        roomCode: targetRoom,
        sessionId: session.id,
        color: data.color || '#007ACC',
      });

      this.logger.log(
        `Usuario ${data.userName} (${data.userId}) se unió a la sala ${targetRoom}`,
      );

      // Notificar a los otros usuarios en la sala
      client.to(targetRoom).emit('user_joined', {
        userId: data.userId,
        userName: data.userName,
        color: data.color || '#007ACC',
        socketId: client.id,
        participants: session.participants,
      });

      return {
        success: true,
        session,
      };
    } catch (err) {
      this.logger.error(`Error al unirse a la sala: ${err}`);
      return {
        success: false,
        session: null,
      };
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { roomCode: string; userId: string; sessionId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean }> {
    client.leave(data.roomCode);

    if (data.sessionId && data.userId) {
      await this.yjsSyncService.leaveSession(data.sessionId, data.userId);
    }

    this.server.to(data.roomCode).emit('user_left', {
      userId: data.userId,
      socketId: client.id,
    });

    this.clientMap.delete(client.id);
    return { success: true };
  }

  @SubscribeMessage('cursor_move')
  handleCursorMove(
    @MessageBody()
    data: {
      roomCode: string;
      userId: string;
      userName: string;
      x: number;
      y: number;
      color?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    client.to(data.roomCode).emit('cursor_moved', {
      userId: data.userId,
      userName: data.userName,
      x: data.x,
      y: data.y,
      color: data.color || '#007ACC',
    });
  }

  @SubscribeMessage('node_drag')
  handleNodeDrag(
    @MessageBody()
    data: {
      roomCode: string;
      nodeId: string;
      position: { x: number; y: number };
      userId: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    client.to(data.roomCode).emit('node_dragged', {
      nodeId: data.nodeId,
      position: data.position,
      userId: data.userId,
    });
  }

  @SubscribeMessage('diagram_sync')
  handleDiagramSync(
    @MessageBody()
    data: {
      roomCode: string;
      nodes: any[];
      connections: any[];
      userId: string;
      action?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    client.to(data.roomCode).emit('diagram_synced', {
      nodes: data.nodes,
      connections: data.connections,
      userId: data.userId,
      action: data.action || 'update',
    });
  }

  @SubscribeMessage('chat_message')
  handleChatMessage(
    @MessageBody()
    data: {
      roomCode: string;
      userId: string;
      userName: string;
      message: string;
    },
  ): void {
    this.server.to(data.roomCode).emit('chat_message_received', {
      userId: data.userId,
      userName: data.userName,
      message: data.message,
      timestamp: new Date().toISOString(),
    });
  }
}
