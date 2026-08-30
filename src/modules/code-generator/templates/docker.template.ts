import { ProjectContext } from './template-models';

export function renderDockerfile(context: ProjectContext): string {
  const javaVer = context.javaVersion === '17' ? '17' : '21';
  return `# =========================================================================
# STAGE 1: BUILD JAR CON MAVEN
# =========================================================================
FROM maven:3.9.6-eclipse-temurin-${javaVer}-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B

# =========================================================================
# STAGE 2: RUNTIME CONTAINER LIGERO
# =========================================================================
FROM eclipse-temurin:${javaVer}-jre-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
COPY --from=builder /app/target/*.jar app.jar
EXPOSE ${context.serverPort || 8080}
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
`;
}

export function renderDockerCompose(context: ProjectContext): string {
  const dbName = context.databaseName || 'app_db';
  const dbUser = context.databaseUser || 'postgres';
  const dbPass = context.databasePassword || 'postgres';
  const dbPort = context.databasePort || 5432;
  const srvPort = context.serverPort || 8080;

  return `services:
  # =========================================================================
  # BASE DE DATOS POSTGRESQL 16
  # =========================================================================
  db:
    image: postgres:16-alpine
    container_name: ${context.artifactId}-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${dbName}
      POSTGRES_USER: ${dbUser}
      POSTGRES_PASSWORD: ${dbPass}
    ports:
      - "${dbPort}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${dbUser} -d ${dbName}"]
      interval: 5s
      timeout: 5s
      retries: 5

  # =========================================================================
  # APLICACIÓN SPRING BOOT (MICROSERVICIO)
  # =========================================================================
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${context.artifactId}-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${srvPort}:${srvPort}"
    environment:
      PORT: ${srvPort}
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: ${dbName}
      DB_USER: ${dbUser}
      DB_PASS: ${dbPass}
      SPRING_PROFILES_ACTIVE: prod

volumes:
  pgdata:
    driver: local
`;
}
