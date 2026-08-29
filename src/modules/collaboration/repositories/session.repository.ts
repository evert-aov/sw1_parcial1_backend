import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborationSession } from '../entities/collaboration-session.entity';
import { SessionParticipant } from '../entities/session-participant.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(CollaborationSession)
    private readonly sessionRepo: Repository<CollaborationSession>,
    @InjectRepository(SessionParticipant)
    private readonly participantRepo: Repository<SessionParticipant>,
  ) {}

  async createOrGetActiveSession(
    diagramId: string,
    customRoomCode?: string,
  ): Promise<CollaborationSession> {
    let session = await this.sessionRepo.findOne({
      where: { diagramId, isActive: true },
      relations: {
        participants: {
          user: true,
        },
      },
    });

    if (!session) {
      const roomCode =
        customRoomCode ||
        `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      session = this.sessionRepo.create({
        diagramId,
        roomCode,
        isActive: true,
      });

      await this.sessionRepo.save(session);
      return this.findById(session.id) as Promise<CollaborationSession>;
    }

    return session;
  }

  async findById(sessionId: string): Promise<CollaborationSession | null> {
    return this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: {
        diagram: true,
        participants: {
          user: true,
        },
      },
    });
  }

  async findByDiagramId(diagramId: string): Promise<CollaborationSession | null> {
    return this.sessionRepo.findOne({
      where: { diagramId, isActive: true },
      relations: {
        diagram: true,
        participants: {
          user: true,
        },
      },
    });
  }

  async findByRoomCode(roomCode: string): Promise<CollaborationSession | null> {
    return this.sessionRepo.findOne({
      where: { roomCode },
      relations: {
        diagram: true,
        participants: {
          user: true,
        },
      },
    });
  }

  async addOrUpdateParticipant(
    sessionId: string,
    userId: string,
    cursorColor = '#007ACC',
    isConnected = true,
  ): Promise<SessionParticipant> {
    let participant = await this.participantRepo.findOne({
      where: { sessionId, userId },
    });

    if (!participant) {
      participant = this.participantRepo.create({
        sessionId,
        userId,
        cursorColor,
        isConnected,
        lastSeenAt: new Date(),
      });
    } else {
      participant.isConnected = isConnected;
      if (cursorColor) {
        participant.cursorColor = cursorColor;
      }
      participant.lastSeenAt = new Date();
    }

    return this.participantRepo.save(participant);
  }

  async setParticipantDisconnected(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    await this.participantRepo.update(
      { sessionId, userId },
      { isConnected: false, lastSeenAt: new Date() },
    );
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.sessionRepo.update(sessionId, { isActive: false });
    await this.participantRepo.update(
      { sessionId },
      { isConnected: false, lastSeenAt: new Date() },
    );
  }
}
