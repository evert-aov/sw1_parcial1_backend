import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { VertexAiService } from './services/vertex-ai.service';
import { AiAssistantService } from './services/ai-assistant.service';
import { AiAssistantController } from './controllers/ai-assistant.controller';

@Module({
  imports: [
    ConfigModule,
    CollaborationModule,
  ],
  controllers: [AiAssistantController],
  providers: [
    VertexAiService,
    AiAssistantService,
  ],
  exports: [
    AiAssistantService,
    VertexAiService,
  ],
})
export class AiAssistantModule {}
