import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class VertexAiService {
  private readonly logger = new Logger(VertexAiService.name);
  private ai: GoogleGenAI;
  private readonly modelName: string;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    const project = this.configService.get<string>('GCP_PROJECT_ID') || 'psyched-list-507014-d7';
    const location = this.configService.get<string>('GCP_LOCATION') || 'us-central1';
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');

    this.initClient(project, location);
  }

  private initClient(project: string, location: string): void {
    try {
      if (this.apiKey) {
        this.ai = new GoogleGenAI({
          apiKey: this.apiKey,
        });
        this.logger.log(
          `[VertexAI/Gemini] Inicializado con API Key directa, modelo: ${this.modelName}`,
        );
      } else {
        this.ai = new GoogleGenAI({
          vertexai: true,
          project,
          location,
        });
        this.logger.log(
          `[VertexAI] Inicializado con Vertex AI ADC en proyecto: ${project}, región: ${location}, modelo: ${this.modelName}`,
        );
      }
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
      if (error?.message?.includes('invalid_grant') || error?.message?.includes('invalid_rapt')) {
        this.logger.warn(
          '⚠️ Las credenciales ADC de Google Cloud han expirado. Ejecuta en tu terminal: `gcloud auth application-default login` o define `GEMINI_API_KEY` en tu archivo backend/.env',
        );
      }
      throw error;
    }
  }
}
