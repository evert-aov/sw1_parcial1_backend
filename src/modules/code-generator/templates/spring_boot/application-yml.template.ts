import { ProjectContext } from './template-models';

export function renderApplicationYml(context: ProjectContext): string {
  return `server:
  port: \${PORT:${context.serverPort || 8080}}
  error:
    include-message: always
    include-binding-errors: always

spring:
  application:
    name: ${context.artifactId}

  datasource:
    url: \${DATABASE_URL:jdbc:postgresql://\${DB_HOST:localhost}:\${DB_PORT:${context.databasePort || 5432}}/\${DB_NAME:${context.databaseName || 'app_db'}}}
    username: \${DB_USER:${context.databaseUser || 'postgres'}}
    password: \${DB_PASS:${context.databasePassword || 'postgres'}}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 10
      minimum-idle: 2
      idle-timeout: 30000

  jpa:
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        jdbc:
          lob:
            non_contextual_creation: true

  flyway:
    enabled: true
    baseline-on-migrate: true
    locations: classpath:db/migration

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html
    operations-sorter: alpha
    tags-sorter: alpha
    display-request-duration: true

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
${
  context.hasAuth
    ? `
jwt:
  secret: \${JWT_SECRET:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}
  expiration: \${JWT_EXPIRATION:86400000}`
    : ''
}
`;
}
