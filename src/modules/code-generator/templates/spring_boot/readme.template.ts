import { ProjectContext } from './template-models';

export function renderReadme(context: ProjectContext): string {
  const srvPort = context.serverPort || 8080;
  const dbPort = context.databasePort || 5432;
  const dbName = context.databaseName || 'app_db';
  const javaVer = context.javaVersion || '21';

  const lines = [
    `# 🚀 ${context.projectName}`,
    '',
    'Microservicio generado automáticamente por **UML Collaborative Studio & Code Generator** con arquitectura limpia en 5 capas:',
    '* **Entidades JPA:** Mapeo relacional con PostgreSQL.',
    '* **Repositorios:** Spring Data JPA.',
    '* **Servicios de Negocio:** Interfaces e implementaciones con soporte transaccional `@Transactional`.',
    '* **Controladores REST:** Endpoints CRUD documentados con OpenAPI / Swagger UI.',
    '* **DTOs:** Separación de Request / Response con validaciones Jakarta.',
    '* **Migraciones Flyway:** Creación de esquema y claves foráneas en `src/main/resources/db/migration/V1__create_tables.sql`.',
    '',
    '---',
    '',
    '## 🛠 Requisitos Previos',
    `* **Java:** JDK ${javaVer}`,
    '* **Maven:** 3.9+ (o usar `mvnw`)',
    '* **Docker & Docker Compose** (opcional para ejecución en contenedores)',
    '',
    '---',
    '',
    '## 🐳 Ejecución con Docker Compose (Recomendado)',
    '',
    'Levanta la base de datos PostgreSQL y la aplicación Spring Boot con un solo comando:',
    '',
    '```bash',
    'docker compose up --build',
    '```',
    '',
    'Una vez iniciado:',
    `* **API REST Base:** http://localhost:${srvPort}/api/v1`,
    `* **Swagger UI interactivo:** http://localhost:${srvPort}/swagger-ui.html`,
    `* **OpenAPI JSON Spec:** http://localhost:${srvPort}/api-docs`,
    '',
    '---',
    '',
    '## 💻 Ejecución Local con Maven',
    '',
    `1. Asegúrate de tener PostgreSQL corriendo en el puerto ${dbPort} con la base de datos ${dbName}.`,
    '2. Compilar y ejecutar:',
    '',
    '```bash',
    'mvn clean spring-boot:run',
    '```',
    '',
    '---',
    '',
    '## 📌 Endpoints Generados',
    '',
    '| Entidad | Endpoint Base | Operaciones CRUD |',
    '| :--- | :--- | :--- |',
    ...context.classes.map((c) => `| **${c.className}** | \`/api/v1/${c.tableName.replace(/_/g, '-')}\` | GET (all), GET (by id), POST, PUT, DELETE |`),
    '',
    '---',
    '',
    '## 📖 Documentación Interactiva Swagger UI',
    'Para probar peticiones en vivo, interactuar con los endpoints y revisar los esquemas de datos:',
    `👉 http://localhost:${srvPort}/swagger-ui.html`,
  ];

  return lines.join('\n') + '\n';
}
