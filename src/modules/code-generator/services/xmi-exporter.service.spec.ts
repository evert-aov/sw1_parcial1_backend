import { Test, TestingModule } from '@nestjs/testing';
import { XmiExporterService, DiagramAstData } from './xmi-exporter.service';

describe('XmiExporterService', () => {
  let service: XmiExporterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmiExporterService],
    }).compile();

    service = module.get<XmiExporterService>(XmiExporterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should export a UML diagram to complete XMI 2.1 with Enterprise Architect diagrams section', () => {
    const mockDiagram: DiagramAstData = {
      name: 'SistemaVentas',
      defaultLineStyle: 'segment',
      nodes: [
        {
          id: 'node_user',
          name: 'Usuario',
          position: { x: 100, y: 150 },
          width: 220,
          height: 140,
          attributes: [
            { name: 'id', type: 'UUID', visibility: 'private', isPk: true },
            { name: 'email', type: 'String', visibility: 'private' },
          ],
          methods: [
            { name: 'getEmail', returnType: 'String', visibility: 'public', parameters: '' },
          ],
        },
        {
          id: 'node_order',
          name: 'Pedido',
          position: { x: 450, y: 150 },
          width: 220,
          height: 140,
          attributes: [
            { name: 'id', type: 'UUID', visibility: 'private', isPk: true },
            { name: 'total', type: 'Double', visibility: 'private' },
          ],
          methods: [],
        },
      ],
      connections: [
        {
          id: 'conn_1',
          sourceNodeId: 'node_user',
          targetNodeId: 'node_order',
          type: 'composition',
          name: 'realiza',
          sourceMultiplicity: '1',
          targetMultiplicity: '0..*',
        },
      ],
    };

    const xml = service.exportToXmi(mockDiagram);

    expect(xml).toContain('<?xml version="1.0" encoding="windows-1252"?>');
    expect(xml).toContain('<xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"');
    expect(xml).toContain('<xmi:Documentation exporter="Enterprise Architect"');
    expect(xml).toContain('<uml:Model xmi:type="uml:Model"');
    expect(xml).toContain('<packagedElement xmi:type="uml:Class"');
    expect(xml).toContain('name="Usuario"');
    expect(xml).toContain('name="Pedido"');
    expect(xml).toContain('name="id"');
    expect(xml).toContain('name="total"');
    expect(xml).toContain('<packagedElement xmi:type="uml:Association"');
    expect(xml).toContain('<xmi:Extension extender="Enterprise Architect"');
    expect(xml).toContain('<connectors>');
    expect(xml).toContain('<connector');
    expect(xml).toContain('<diagrams>');
    expect(xml).toContain('<diagram');
    expect(xml).toContain('Left=100;Top=150;Right=320;Bottom=290;');
    expect(xml).toContain('Left=450;Top=150;Right=670;Bottom=290;');
  });

  it('should export an AssociationClass intermediate table with EA associationclass links and metadata', () => {
    const mockDiagram: DiagramAstData = {
      name: 'VentasAssoc',
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
            { name: 'quantity', type: 'int' },
          ],
          assocMainConnId: 'conn_order_prod_main',
        },
      ],
      connections: [
        {
          id: 'conn_order_prod_main',
          sourceNodeId: 'node_order',
          targetNodeId: 'node_prod',
          type: 'association',
          name: 'Order_Products',
          sourceMultiplicity: '*',
          targetMultiplicity: '*',
          assocAnchorNodeId: 'anchor_1',
        },
        {
          id: 'conn_dashed_1',
          sourceNodeId: 'anchor_1',
          targetNodeId: 'node_order_prod',
          type: 'association_class',
          name: '«link»',
        },
      ],
    };

    const xml = service.exportToXmi(mockDiagram);

    // AssociationClass packagedElement in uml:Model
    expect(xml).toContain('<packagedElement xmi:type="uml:AssociationClass"');
    expect(xml).toContain('name="OrderProduct"');
    expect(xml).toContain('name="quantity"');

    // Should NOT emit a duplicate uml:Association in uml:Model
    expect(xml).not.toContain('<packagedElement xmi:type="uml:Association"');

    // Element in EA extension with sType="Class", nType="17" and conID pointing to connector
    expect(xml).toContain('sType="Class" nType="17"');
    expect(xml).toContain('conID="');

    // Connector in EA extension with ea_type="Association", subtype="Class", and extendedProperties associationclass
    expect(xml).toContain('properties ea_type="Association" subtype="Class"');
    expect(xml).toContain('<extendedProperties virtualInheritance="0" associationclass="');
    expect(xml).toContain('<labels/>');
  });
});
