import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class VertexAiService {
  private readonly logger = new Logger(VertexAiService.name);
  private ai: GoogleGenAI;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const project = this.configService.get<string>('GCP_PROJECT_ID') || 'psyched-list-507014-d7';
    const location = this.configService.get<string>('GCP_LOCATION') || 'us-central1';
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';

    try {
      this.ai = new GoogleGenAI({
        vertexai: true,
        project,
        location,
      });
      this.logger.log(
        `[VertexAI] Inicializado en proyecto: ${project}, región: ${location}, modelo: ${this.modelName}`,
      );
    } catch (err) {
      this.logger.error(`[VertexAI] Error al instanciar GoogleGenAI: ${err}`);
    }
  }

  async generateContent(options: {
    systemInstruction?: string;
    contents: any;
    responseMimeType?: string;
  }): Promise<string> {
    try {
      const config: any = {};
      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: options.contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      return response.text || '';
    } catch (error: any) {
      this.logger.error(`[VertexAI] Error ejecutando generateContent: ${error.message || error}`);
      throw error;
    }
  }
}
