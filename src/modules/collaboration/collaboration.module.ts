import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { SessionParticipant } from './entities/session-participant.entity';
import { SessionRepository } from './repositories/session.repository';
import { YjsSyncService } from './services/yjs-sync.service';
import { CollaborationGateway } from './gateways/collaboration.gateway';
import { CollaborationController } from './controllers/collaboration.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollaborationSession, SessionParticipant]),
  ],
  controllers: [CollaborationController],
  providers: [
    SessionRepository,
    YjsSyncService,
    CollaborationGateway,
  ],
  exports: [
    SessionRepository,
    YjsSyncService,
    CollaborationGateway,
  ],
})
export class CollaborationModule {}
