import { Test, TestingModule } from '@nestjs/testing';
import { SpringTemplateEngineService } from './spring-template-engine.service';
import { GenerateCodeRequestDto } from '../dtos/generate-code-request.dto';

describe('SpringTemplateEngineService', () => {
  let service: SpringTemplateEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpringTemplateEngineService],
    }).compile();

    service = module.get<SpringTemplateEngineService>(SpringTemplateEngineService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe generar las 5 capas de Spring Boot, Flyway, Dockerfile, docker-compose y README a partir de un AST', () => {
    const dto: GenerateCodeRequestDto = {
      packageName: 'com.uagrm.ventas',
      artifactId: 'ventas-api',
      projectName: 'Sistema de Ventas',
      javaVersion: '21',
      databaseName: 'ventas_db',
    };

    const mockNodes = [
      {
        id: 'node-1',
        name: 'Producto',
        attributes: [
          { name: 'id', type: 'UUID', isNullable: false },
          { name: 'nombre', type: 'String', isNullable: false },
          { name: 'precio', type: 'Double', isNullable: false },
        ],
        methods: [
          { name: 'calcularDescuento', parameters: 'Double porcentaje', returnType: 'Double' },
        ],
      },
      {
        id: 'node-2',
        name: 'Categoria',
        attributes: [
          { name: 'id', type: 'UUID', isNullable: false },
          { name: 'codigo', type: 'String', isNullable: false },
          { name: 'descripcion', type: 'String', isNullable: true },
        ],
        methods: [],
      },
    ];

    const mockConnections = [
      {
        id: 'conn-1',
        sourceNodeId: 'node-2',
        targetNodeId: 'node-1',
        sourceId: 'node-2_right',
        targetId: 'node-1_left',
        type: 'association',
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
      },
    ];

    const result = service.generateProjectFiles(dto, mockNodes, mockConnections);

    expect(result).toBeDefined();
    expect(result.files.length).toBeGreaterThan(10);

    // Verificar capas generadas
    const entityFiles = result.files.filter((f) => f.layer === 'entity');
    expect(entityFiles.length).toBe(2);
    expect(entityFiles.some((f) => f.filename === 'Producto.java')).toBe(true);
    expect(entityFiles.some((f) => f.filename === 'Categoria.java')).toBe(true);

    const repoFiles = result.files.filter((f) => f.layer === 'repository');
    expect(repoFiles.length).toBe(2);
    expect(repoFiles.some((f) => f.filename === 'ProductoRepository.java')).toBe(true);

    const dtoFiles = result.files.filter((f) => f.layer === 'dto');
    expect(dtoFiles.length).toBe(6); // Create, Update, Response por cada una

    const serviceFiles = result.files.filter((f) => f.layer === 'service');
    expect(serviceFiles.length).toBe(4); // Interface + Impl por cada una

    const controllerFiles = result.files.filter((f) => f.layer === 'controller');
    expect(controllerFiles.length).toBe(2);
    expect(controllerFiles.some((f) => f.filename === 'ProductoController.java')).toBe(true);

    // Verificar Swagger UI y OpenAPI en Controller
    const productoController = controllerFiles.find((f) => f.filename === 'ProductoController.java')!;
    expect(productoController.content).toContain('@Tag(name = "Producto"');
    expect(productoController.content).toContain('@Operation(summary = "Listar todos los registros de Producto")');

    // Verificar Flyway Migration SQL
    const flywayFile = result.files.find((f) => f.layer === 'migration')!;
    expect(flywayFile).toBeDefined();
    expect(flywayFile.content).toContain('CREATE TABLE IF NOT EXISTS "producto"');
    expect(flywayFile.content).toContain('CREATE TABLE IF NOT EXISTS "categoria"');
    expect(flywayFile.content).toContain('FOREIGN KEY');

    // Verificar Docker y docker-compose
    const dockerComposeFile = result.files.find((f) => f.filename === 'docker-compose.yml')!;
    expect(dockerComposeFile).toBeDefined();
    expect(dockerComposeFile.content).toContain('image: postgres:16-alpine');
    expect(dockerComposeFile.content).toContain('ventas_db');

    // Verificar pom.xml
    const pomFile = result.files.find((f) => f.filename === 'pom.xml')!;
    expect(pomFile.content).toContain('springdoc-openapi-starter-webmvc-ui');
    expect(pomFile.content).toContain('flyway-core');
  });
});
