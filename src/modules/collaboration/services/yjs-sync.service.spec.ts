import { Test, TestingModule } from '@nestjs/testing';
import { YjsSyncService } from './yjs-sync.service';
import { SessionRepository } from '../repositories/session.repository';
import { NotFoundException } from '@nestjs/common';

describe('YjsSyncService', () => {
  let service: YjsSyncService;
  let sessionRepository: jest.Mocked<SessionRepository>;

  const mockSession: any = {
    id: 'sess-123',
    diagramId: 'diag-123',
    roomCode: 'ROOM-TEST1',
    isActive: true,
    startedAt: new Date(),
    participants: [
      {
        id: 'part-1',
        userId: 'user-1',
        sessionId: 'sess-123',
        cursorColor: '#007ACC',
        isConnected: true,
        lastSeenAt: new Date(),
        user: { fullName: 'Evert User', email: 'evert@uagrm.edu.bo' },
      },
    ],
  };

  beforeEach(async () => {
    const mockRepo = {
      createOrGetActiveSession: jest.fn().mockResolvedValue(mockSession),
      findById: jest.fn().mockResolvedValue(mockSession),
      findByDiagramId: jest.fn().mockResolvedValue(mockSession),
      findByRoomCode: jest.fn().mockResolvedValue(mockSession),
      addOrUpdateParticipant: jest.fn().mockResolvedValue(mockSession.participants[0]),
      setParticipantDisconnected: jest.fn().mockResolvedValue(undefined),
      closeSession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YjsSyncService,
        {
          provide: SessionRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<YjsSyncService>(YjsSyncService);
    sessionRepository = module.get(SessionRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinOrCreateSession', () => {
    it('should create or join active session and register participant', async () => {
      const result = await service.joinOrCreateSession(
        { diagramId: 'diag-123', cursorColor: '#FF0000' },
        'user-1',
      );

      expect(sessionRepository.createOrGetActiveSession).toHaveBeenCalledWith('diag-123', undefined);
      expect(sessionRepository.addOrUpdateParticipant).toHaveBeenCalledWith('sess-123', 'user-1', '#FF0000', true);
      expect(result.id).toBe('sess-123');
      expect(result.roomCode).toBe('ROOM-TEST1');
      expect(result.participants.length).toBe(1);
    });
  });

  describe('getSessionById', () => {
    it('should return session if found', async () => {
      const result = await service.getSessionById('sess-123');
      expect(result.id).toBe('sess-123');
    });

    it('should throw NotFoundException if session not found', async () => {
      sessionRepository.findById.mockResolvedValueOnce(null);
      await expect(service.getSessionById('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveSessionByDiagram', () => {
    it('should return active session for diagram', async () => {
      const result = await service.getActiveSessionByDiagram('diag-123');
      expect(result).not.toBeNull();
      expect(result?.diagramId).toBe('diag-123');
    });

    it('should return null if no active session', async () => {
      sessionRepository.findByDiagramId.mockResolvedValueOnce(null);
      const result = await service.getActiveSessionByDiagram('diag-999');
      expect(result).toBeNull();
    });
  });

  describe('leaveSession', () => {
    it('should mark participant as disconnected', async () => {
      await service.leaveSession('sess-123', 'user-1');
      expect(sessionRepository.setParticipantDisconnected).toHaveBeenCalledWith('sess-123', 'user-1');
    });
  });

  describe('closeSession', () => {
    it('should close active session', async () => {
      const result = await service.closeSession('sess-123');
      expect(sessionRepository.closeSession).toHaveBeenCalledWith('sess-123');
      expect(result.success).toBe(true);
    });
  });
});
