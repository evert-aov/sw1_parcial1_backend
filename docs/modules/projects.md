# 📁 Módulo de Gestión de Proyectos y Equipos (Projects Module)

## 📌 Descripción General
El **Módulo de Proyectos** gestiona la creación, configuración técnica (versión de Java, Spring Boot, paquete base), administración de miembros colaboradores y control de acceso basado en roles (**RBAC**: `OWNER`, `EDITOR`, `VIEWER`). Al crear un proyecto, el sistema inicializa automáticamente su diagrama UML principal.

---

## 🏛 Arquitectura en 5 Capas (Backend)

```
src/modules/projects/
├── controllers/          # [Capa 1] Controladores REST & Swagger (ProjectController, MemberController)
├── services/             # [Capa 2] Lógica de Negocio y Validación de Roles (ProjectService)
├── repositories/         # [Capa 3] Acceso a Datos TypeORM (ProjectRepository, ProjectMemberRepository)
├── entities/             # [Capa 4] Entidades 'projects' y 'project_members'
├── dtos/                 # [Capa 5] DTOs de Validación de Entrada y Salida
└── guards/               # ProjectRoleGuard para verificación de permisos granulares
```

---

## 👥 Matriz de Roles y Permisos en el Proyecto

| Acción / Operación | OWNER (Propietario) | EDITOR (Colaborador) | VIEWER (Espectador) |
| :--- | :---: | :---: | :---: |
| Ver Detalles y Listado del Proyecto | ✅ | ✅ | ✅ |
| Abrir y Ver Diagrama en Tiempo Real | ✅ | ✅ | ✅ |
| Editar Metadatos del Proyecto (`nombre`, `paquete`, `javaVersion`) | ✅ | ✅ | ❌ |
| Modificar Clases y Relaciones UML en el Canvas | ✅ | ✅ | ❌ (Solo Lectura) |
| Invitar Nuevos Miembros al Proyecto | ✅ | ❌ | ❌ |
| Cambiar Rol de Miembros (`EDITOR` ↔ `VIEWER`) | ✅ | ❌ | ❌ |
| Expulsar Miembros del Proyecto | ✅ | ❌ | ❌ |
| Eliminar Proyecto Completo y Diagramas | ✅ | ❌ | ❌ |

---

## 📋 Casos de Uso del Módulo

### 🔹 CU-03: Gestión de Proyectos
* **Actor Principal:** Usuario Autenticado (`OWNER` / `EDITOR`).
* **Descripción:** Permite la creación de nuevos proyectos de modelado UML, modificación de su configuración técnica y metadatos, consulta de listados y eliminación completa con borrado en cascada.
* **Flujo Principal (Creación):**
  1. El usuario hace clic en `+ Nuevo Proyecto` y completa el formulario (`name`, `description`, `basePackage`, `javaVersion: 17|21`, `springBootVersion`).
  2. El frontend envía `POST /api/projects`.
  3. `ProjectService` crea el proyecto asociando al usuario autenticado como `OWNER` en la tabla `project_members`.
  4. Se crea automáticamente el diagrama de clases raíz ("Diagrama Principal") para inicializar el workspace.
  5. Se responde con `201 Created` y el proyecto se lista en la pantalla del usuario.
* **Flujo Principal (Modificación de Características):**
  1. El usuario (`OWNER` o `EDITOR`) abre el modal `Editar Proyecto`.
  2. Modifica el nombre, descripción, paquete base (`e.g. com.uagrm.ventas`) o versiones de Java/Spring Boot.
  3. El frontend envía `PUT /api/projects/:id`.
  4. `ProjectService` valida los permisos del rol y persiste los cambios retornando `200 OK`.
* **Flujo Principal (Eliminación):**
  1. El propietario (`OWNER`) confirma la eliminación del proyecto.
  2. El frontend envía `DELETE /api/projects/:id`.
  3. Se eliminan en cascada los miembros, diagramas, nodos, conexiones y sesiones de colaboración asociadas.
  4. Se responde con `200 OK`.

---

### 🔹 CU-04: Gestión de Miembros y Roles
* **Actor Principal:** `OWNER` (Propietario del Proyecto).
* **Descripción:** Permite invitar colaboradores al workspace mediante correo electrónico, asignar roles (`EDITOR` o `VIEWER`), modificar roles en caliente y revocar accesos.
* **Flujo Principal (Invitación de Miembros):**
  1. El propietario abre el panel `Miembros del Proyecto`.
  2. Ingresa el correo del colaborador (ej. `jose@uagrm.edu.bo`) y selecciona el rol (`EDITOR` o `VIEWER`).
  3. El frontend envía `POST /api/projects/:id/members`.
  4. `ProjectService` busca el usuario por email, valida que no sea miembro actualmente y crea el registro en `project_members` (`201 Created`).
* **Flujo Principal (Modificación de Rol):**
  1. El propietario cambia el rol de un colaborador (`EDITOR` ↔ `VIEWER`).
  2. El frontend envía `PATCH /api/projects/:id/members/:memberId/role` con `{ role: "VIEWER" }`.
  3. Se actualiza el rol en base de datos. Si el usuario afectado está en el diagrama, sus permisos se ajustan en caliente a modo solo lectura.
* **Flujo Principal (Expulsión de Miembros):**
  1. El propietario hace clic en eliminar miembro.
  2. El frontend envía `DELETE /api/projects/:id/members/:memberId`.
  3. Se revoca el acceso del usuario al proyecto y a sus diagramas asociados.

---

## 📊 Diagrama de Secuencia Mermaid: Gestión de Proyectos y Miembros

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Propietario (Evert)
    actor Collab as Colaborador (José)
    participant UI as Angular Dashboard
    participant API as ProjectController
    participant Srv as ProjectService
    participant Repo as ProjectRepository
    participant DB as PostgreSQL (projects, members)

    Note over Owner,DB: 1. Gestión de Proyectos (CU-03)
    Owner->>UI: Crea Proyecto "Sistema de Ferretería"
    UI->>API: POST /api/projects (CreateProjectDto)
    API->>Srv: createProject(dto, ownerId)
    Srv->>Repo: save(projectEntity)
    Repo->>DB: INSERT INTO projects ...
    Repo->>DB: INSERT INTO project_members (userId, role: 'OWNER') ...
    Repo->>DB: INSERT INTO diagrams (name: 'Diagrama Principal') ...
    DB-->>Srv: Proyecto creado con éxito
    Srv-->>API: ProjectResponseDto
    API-->>UI: 201 Created
    UI-->>Owner: Muestra card de proyecto

    Note over Owner,Collab: 2. Gestión de Miembros y Roles (CU-04)
    Owner->>UI: Invita "jose@uagrm.edu.bo" como 'EDITOR'
    UI->>API: POST /api/projects/:id/members ({ email, role: 'EDITOR' })
    API->>Srv: addMember(projectId, email, role, currentUserId)
    Srv->>Srv: Valida que currentUserId sea OWNER
    Srv->>Repo: addMemberRecord(...)
    Repo->>DB: INSERT INTO project_members VALUES (...)
    DB-->>Srv: Miembro agregado
    Srv-->>API: 201 Created
    API-->>UI: Lista de miembros actualizada

    Note over Collab,UI: 3. Acceso del Colaborador
    Collab->>UI: Inicia sesión como José
    UI->>API: GET /api/projects
    API-->>UI: Retorna "Sistema de Ferretería" con userRole: 'EDITOR'
    Collab->>UI: Abre el diagrama para co-edición en vivo
```

---

## 🔌 Especificación de Endpoints REST

| Método | Ruta | Seguridad | Roles Permitidos | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/projects` | Bearer JWT | Todos | Lista los proyectos propios y compartidos del usuario |
| `POST` | `/api/projects` | Bearer JWT | Todos | Crea un nuevo proyecto y diagrama inicial |
| `GET` | `/api/projects/:id` | Bearer JWT | `OWNER`, `EDITOR`, `VIEWER` | Obtiene el detalle del proyecto con sus miembros |
| `PUT` | `/api/projects/:id` | Bearer JWT | `OWNER`, `EDITOR` | Modifica configuración técnica y metadatos |
| `DELETE` | `/api/projects/:id` | Bearer JWT | `OWNER` | Elimina el proyecto y todos sus diagramas en cascada |
| `POST` | `/api/projects/:id/members` | Bearer JWT | `OWNER` | Invita un nuevo usuario por email con rol asignado |
| `PATCH` | `/api/projects/:id/members/:memberId/role` | Bearer JWT | `OWNER` | Cambia el rol de un miembro (`EDITOR` o `VIEWER`) |
| `DELETE` | `/api/projects/:id/members/:memberId` | Bearer JWT | `OWNER` | Expulsa a un colaborador del proyecto |

---

## 📦 Data Transfer Objects (DTOs)

### 1. `CreateProjectDto`
```typescript
export class CreateProjectDto {
  @ApiProperty({ example: 'Sistema de Ventas' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Microservicio de ventas y facturación' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'com.uagrm.ventas', default: 'com.example.uml' })
  @IsOptional()
  @IsString()
  basePackage?: string;

  @ApiProperty({ example: 21, default: 21 })
  @IsOptional()
  @IsInt()
  javaVersion?: number;

  @ApiProperty({ example: '3.3.0', default: '3.3.0' })
  @IsOptional()
  @IsString()
  springBootVersion?: string;
}
```

### 2. `AddMemberDto`
```typescript
export class AddMemberDto {
  @ApiProperty({ example: 'jose@uagrm.edu.bo' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: ['EDITOR', 'VIEWER'], default: 'EDITOR' })
  @IsEnum(['EDITOR', 'VIEWER'])
  role: 'EDITOR' | 'VIEWER';
}
```

---

## 🧪 Pruebas Unitarias
Cobertura ejecutada mediante `npm test` en backend:
* `project.service.spec.ts`: Pruebas de CRUD de proyectos, inicialización automática de diagrama, invitaciones de miembros y validación de permisos de rol.
* `project.controller.spec.ts`: Cobertura de endpoints REST HTTP de proyectos y miembros.
