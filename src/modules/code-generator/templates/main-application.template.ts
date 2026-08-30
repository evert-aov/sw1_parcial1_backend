import { ProjectContext } from './template-models';

export function renderMainApplication(context: ProjectContext): string {
  const appClassName = context.artifactId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Application';

  return `package ${context.packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.Contact;

/**
 * Clase principal de entrada del microservicio Spring Boot.
 * Autogenerada por UML Studio Architecture Generator.
 */
@SpringBootApplication
@OpenAPIDefinition(
    info = @Info(
        title = "${context.projectName}",
        version = "1.0.0",
        description = "API REST generada a partir del modelado de clases UML con soporte para PostgreSQL y Flyway",
        contact = @Contact(name = "UML Collaborative Studio", email = "developer@uagrm.edu.bo")
    )
)
public class ${appClassName} {

    public static void main(String[] args) {
        SpringApplication.run(${appClassName}.class, args);
    }
}
`;
}
