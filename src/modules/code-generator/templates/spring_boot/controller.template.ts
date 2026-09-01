import { JavaClassMeta } from './template-models';

export function renderController(meta: JavaClassMeta): string {
  const idType = meta.idField.javaType;
  const endpointPath = meta.tableName.replace(/_/g, '-');
  const imports: string[] = [
    'java.util.UUID',
    'java.util.List',
    'jakarta.validation.Valid',
    'org.springframework.http.HttpStatus',
    'org.springframework.http.ResponseEntity',
    'org.springframework.web.bind.annotation.*',
    'io.swagger.v3.oas.annotations.Operation',
    'io.swagger.v3.oas.annotations.tags.Tag',
    'io.swagger.v3.oas.annotations.responses.ApiResponse',
    'io.swagger.v3.oas.annotations.responses.ApiResponses',
    `${meta.basePackage}.dtos.Create${meta.className}Dto`,
    `${meta.basePackage}.dtos.Update${meta.className}Dto`,
    `${meta.basePackage}.dtos.${meta.className}ResponseDto`,
    `${meta.basePackage}.services.${meta.className}Service`,
  ];

  const uniqueImports = Array.from(new Set(imports)).sort();
  const importStatements = uniqueImports.map((i) => `import ${i};`).join('\n');

  return `package ${meta.basePackage}.controllers;

${importStatements}

/**
 * Controlador REST para la gestión de ${meta.className}.
 * Integra documentación OpenAPI / Swagger UI interactiva.
 */
@RestController
@RequestMapping("/api/v1/${endpointPath}")
@Tag(name = "${meta.className}", description = "API REST y operaciones CRUD para ${meta.className}")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class ${meta.className}Controller {

    private final ${meta.className}Service service;

    public ${meta.className}Controller(${meta.className}Service service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Listar todos los registros de ${meta.className}")
    @ApiResponse(responseCode = "200", description = "Lista recuperada exitosamente")
    public ResponseEntity<List<${meta.className}ResponseDto>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener un registro de ${meta.className} por su ID")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Registro encontrado"),
        @ApiResponse(responseCode = "404", description = "${meta.className} no encontrado")
    })
    public ResponseEntity<${meta.className}ResponseDto> findById(@PathVariable ${idType} id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    @Operation(summary = "Crear un nuevo registro de ${meta.className}")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "${meta.className} creado exitosamente"),
        @ApiResponse(responseCode = "400", description = "Datos de entrada inválidos")
    })
    public ResponseEntity<${meta.className}ResponseDto> create(@Valid @RequestBody Create${meta.className}Dto dto) {
        return new ResponseEntity<>(service.create(dto), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar un registro existente de ${meta.className}")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "${meta.className} actualizado"),
        @ApiResponse(responseCode = "404", description = "${meta.className} no encontrado")
    })
    public ResponseEntity<${meta.className}ResponseDto> update(
            @PathVariable ${idType} id,
            @Valid @RequestBody Update${meta.className}Dto dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar un registro de ${meta.className}")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "${meta.className} eliminado exitosamente"),
        @ApiResponse(responseCode = "404", description = "${meta.className} no encontrado")
    })
    public ResponseEntity<Void> delete(@PathVariable ${idType} id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
`;
}
