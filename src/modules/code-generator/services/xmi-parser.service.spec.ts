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
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);

      const aNode = result.nodes[0];
      expect(aNode).toBeDefined();
      expect(aNode.position).toBeDefined();
      expect(typeof aNode.position.x).toBe('number');
      expect(typeof aNode.position.y).toBe('number');

      expect(result.connections).toBeDefined();
    }
  });

  it('should throw BadRequestException if XML is empty or invalid', () => {
    expect(() => service.parseXmi('')).toThrow();
  });

  it('should reconstruct anchor node and dashed association_class link when importing AssociationClass from EA XMI', () => {
    const { XmiExporterService } = require('./xmi-exporter.service');
    const exporter = new XmiExporterService();

    const mockDiagram = {
      name: 'RoundTripTest',
      nodes: [
        {
          id: 'node_order',
          name: 'Order',
          position: { x: 50, y: 100 },
          width: 200,
          height: 120,
          attributes: [{ name: 'id', type: 'UUID', isPk: true }],
        },
        {
          id: 'node_prod',
          name: 'Products',
          position: { x: 500, y: 100 },
          width: 200,
          height: 120,
          attributes: [{ name: 'id', type: 'UUID', isPk: true }],
        },
        {
          id: 'anchor_1',
          name: '',
          position: { x: 300, y: 160 },
          width: 14,
          height: 14,
          isAnchor: true,
        },
        {
          id: 'node_order_prod',
          name: 'OrderProduct',
          position: { x: 250, y: 300 },
          width: 220,
          height: 120,
          attributes: [
            { name: 'orderId', type: 'UUID' },
            { name: 'productId', type: 'UUID' },
          ],
          assocMainConnId: 'conn_main',
        },
      ],
      connections: [
        {
          id: 'conn_main',
          sourceNodeId: 'node_order',
          targetNodeId: 'node_prod',
          type: 'association',
          name: 'Order_Products',
          sourceMultiplicity: '*',
          targetMultiplicity: '*',
          assocAnchorNodeId: 'anchor_1',
        },
        {
          id: 'conn_dashed',
          sourceNodeId: 'anchor_1',
          targetNodeId: 'node_order_prod',
          type: 'association_class',
          name: '«link»',
        },
      ],
    };

    const xml = exporter.exportToXmi(mockDiagram);
    const parsed = service.parseXmi(xml);

    expect(parsed).toBeDefined();

    // Verify anchor node was created
    const anchor = parsed.nodes.find(n => n.isAnchor);
    expect(anchor).toBeDefined();

    // Verify intermediate class was associated
    const assocNode = parsed.nodes.find(n => n.name === 'OrderProduct');
    expect(assocNode).toBeDefined();
    expect(assocNode?.assocMainConnId).toBeDefined();

    // Verify main connection has assocAnchorNodeId set
    const mainConn = parsed.connections.find(c => c.id === assocNode?.assocMainConnId);
    expect(mainConn).toBeDefined();
    expect(mainConn?.assocAnchorNodeId).toBe(anchor?.id);

    // Verify dashed link was created
    const dashedLink = parsed.connections.find(c => c.type === 'association_class');
    expect(dashedLink).toBeDefined();
    expect(dashedLink?.name).toBe('«link»');
  });
});
