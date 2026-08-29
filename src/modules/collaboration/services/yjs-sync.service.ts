import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { SessionResponseDto } from '../dtos/session-response.dto';
import { JoinRoomDto } from '../dtos/join-room.dto';

@Injectable()
export class YjsSyncService {
  constructor(private readonly sessionRepo: SessionRepository) {}

  async joinOrCreateSession(
    dto: JoinRoomDto,
    userId: string,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionRepo.createOrGetActiveSession(
      dto.diagramId,
      dto.roomCode,
    );

    const cursorColor = dto.cursorColor || this.getRandomColor(userId);
    await this.sessionRepo.addOrUpdateParticipant(
      session.id,
      userId,
      cursorColor,
      true,
    );

    const updatedSession = await this.sessionRepo.findById(session.id);
    return SessionResponseDto.fromEntity(updatedSession!);
  }

  async getSessionById(sessionId: string): Promise<SessionResponseDto> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Sesión de colaboración no encontrada');
    }
    return SessionResponseDto.fromEntity(session);
  }

  async getActiveSessionByDiagram(diagramId: string): Promise<SessionResponseDto | null> {
    const session = await this.sessionRepo.findByDiagramId(diagramId);
    if (!session) {
      return null;
    }
    return SessionResponseDto.fromEntity(session);
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    await this.sessionRepo.setParticipantDisconnected(sessionId, userId);
  }

  async closeSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }
    await this.sessionRepo.closeSession(sessionId);
    return { success: true, message: 'Sesión de colaboración finalizada' };
  }

  private getRandomColor(seed: string): string {
    const colors = [
      '#EF4444', // Rojo
      '#F59E0B', // Ámbar
      '#10B981', // Verde esmeralda
      '#3B82F6', // Azul
      '#6366F1', // Índigo
      '#8B5CF6', // Púrpura
      '#EC4899', // Rosa
      '#14B8A6', // Teal
      '#F97316', // Naranja
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
