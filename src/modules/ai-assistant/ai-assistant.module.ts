import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { AiAssistantLog } from './entities/ai-assistant-log.entity';
import { AiAssistantLogRepository } from './repositories/ai-assistant-log.repository';
import { VertexAiService } from './services/vertex-ai.service';
import { AiAssistantService } from './services/ai-assistant.service';
import { AiAssistantController } from './controllers/ai-assistant.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AiAssistantLog]),
    CollaborationModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantLogRepository,
    VertexAiService,
    AiAssistantService,
  ],
  exports: [
    AiAssistantLogRepository,
    AiAssistantService,
    VertexAiService,
  ],
})
export class AiAssistantModule {}
