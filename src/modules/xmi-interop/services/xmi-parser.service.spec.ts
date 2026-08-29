import { Test, TestingModule } from '@nestjs/testing';
import { XmiParserService } from './xmi-parser.service';
import * as fs from 'fs';
import * as path from 'path';

describe('XmiParserService', () => {
  let service: XmiParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmiParserService],
    }).compile();

    service = module.get<XmiParserService>(XmiParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should parse real Enterprise Architect v17 prueba.xml file correctly with positions and classes', () => {
    const filePath = '/home/evert/uagrm/8voSemestre/inf422/General project/prueba.xml';
    if (fs.existsSync(filePath)) {
      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      const result = service.parseXmi(xmlContent);

      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);

      const usersNode = result.nodes.find(n => n.name === 'users');
      expect(usersNode).toBeDefined();
      expect(usersNode!.attributes?.some(a => a.name === 'user_id')).toBe(true);
      expect(usersNode!.methods?.some(m => m.name === 'get_name')).toBe(true);
      expect(usersNode!.position.x).toBe(54);
      expect(usersNode!.position.y).toBe(21);

      const usersCopy = result.nodes.find(n => n.name === 'users - Copy');
      expect(usersCopy).toBeDefined();
      expect(usersCopy!.position.x).toBe(55);
      expect(usersCopy!.position.y).toBe(246);

      expect(result.connections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should throw BadRequestException if XML is empty or invalid', () => {
    expect(() => service.parseXmi('')).toThrow();
  });
});
