# 🚀 UML/ER Studio - Backend API

Servicio backend de alto rendimiento desarrollado con **NestJS**, **TypeORM**, **PostgreSQL** y **Socket.io**. Proporciona la infraestructura REST y en tiempo real para el modelado colaborativo de diagramas de clases UML, integración con modelos de lenguaje multimodal (**Google Gemini**), interoperabilidad con suites CASE tradicionales (**Enterprise Architect XMI 2.1**) y compilación automática de diagramas a código fuente fullstack (**Spring Boot 3 + PostgreSQL** y **Flutter**).

---

## 📌 Tabla de Contenidos
1. [Características Principales](#-características-principales)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Módulos del Backend](#-módulos-del-backend)
4. [Requisitos Previos](#-requisitos-previos)
5. [Variables de Entorno](#-variables-de-entorno)
6. [Instalación y Ejecución](#-instalación-y-ejecución)
7. [Documentación de la API (Swagger)](#-documentación-de-la-api-swagger)
8. [Estructura del Código](#-estructura-del-código)
9. [Scripts Disponibles](#-scripts-disponibles)

---

## ✨ Características Principales

* **Autenticación & Autorización Segura**: JWT con Bcrypt, guardias globales y decorador `@Public()` para rutas públicas.
* **Persistencia Relacional Avanzada**: Esquema relacional en PostgreSQL mapeando el Abstract Syntax Tree (AST) de clases UML (nodos, atributos, métodos, tipos de datos, multiplicidades y relaciones).
* **Colaboración en Tiempo Real (WebSockets)**: Sincronización multiusuario por salas con Socket.io (cursores remotos, arrastre de nodos, bloqueo concurrente `lock_node` y chat).
* **Asistente de Inteligencia Artificial Multimodal**:
  * Orquestación con **Google GenAI SDK** (`@google/genai` / Gemini 2.5 & 2.0).
  * Soporte de prompts conversacionales para mutación estructural en caliente del diagrama.
  * Análisis de visión artificial (Webcam / Bocetos) para digitalizar diagramas dibujados a mano.
* **Generador de Código Fullstack**:
  * **Spring Boot 3+ (Java 17/21)**: Entidades JPA con relaciones `@OneToMany`, `@ManyToOne`, `@ManyToMany`, Repositorios `JpaRepository`, DTOs (`RequestDto`/`ResponseDto`), Servicios transaccionales `@Transactional`, Controladores REST, scripts Flyway (`V1__initial_schema.sql`), `application.yml`, Docker Compose y Maven/Gradle.
  * **Flutter (Dart)**: Modelos de datos Dart con serialización JSON, servicios HTTP para integración REST y arquitectura desacoplada.
  * Previsualización de archivos en memoria y descarga empaquetada en formato `.zip` mediante `jszip`.
* **Interoperabilidad XMI 2.1**:
  * Exportación e importación bidireccional de esquemas XMI compatibles con **Enterprise Architect v17**.
  * Versionado histórico de diagramas con capacidad de restauración de estados previos.

---

## 🏛 Arquitectura del Sistema

El backend está diseñado bajo una arquitectura modular y limpia en 5 capas:

```text
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway & WebSockets                 │
│         - REST Controllers (Pipes de Validación & Swagger)  │
│         - Socket.io Gateways (Salas de Colaboración en vivo)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      Capa de Servicios                      │
│     - Lógica de Negocio      - Orquestador Gemini AI        │
│     - Parser AST / XMI 2.1   - Generadores Spring & Flutter │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Capa de Repositorios                     │
│               - TypeORM Custom Repositories                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Persistencia & Base de Datos              │
│               - PostgreSQL (12+ Entidades Relacionales)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Módulos del Backend

Ubicados en `src/modules/`:

| Módulo | Descripción |
| :--- | :--- |
| **`auth/`** | Registro, login, emisión de tokens JWT, hashing con Bcrypt y gestión de perfiles de usuario. |
| **`projects/`** | Gestión de proyectos colaborativos, permisos de equipo y roles (`OWNER`, `EDITOR`, `VIEWER`). |
| **`diagrams/`** | CRUD del AST del diagrama (clases, atributos, métodos, relaciones, multiplicidades) y log de actividad. |
| **`collaboration/`** | WebSocket Gateway en `/collaboration` para sincronización de cursores, arrastre en vivo, bloqueos de nodos y chat. |
| **`ai-assistant/`** | Integración con LLM multimodal para análisis de bocetos y comandos de mutación en lenguaje natural. |
| **`code-generator/`** | Generación de proyectos completos en Spring Boot y Flutter con empaquetado ZIP. |
| **`xmi-interop/`** | Serialización y deserialización a estándar XMI 2.1 (Enterprise Architect) y control de versiones. |

---

## 📋 Requisitos Previos

* **Node.js**: Versión `20.x` o `22.x` recomendada.
* **npm**: Versión `10.x` o superior.
* **PostgreSQL**: Versión `15` o `16+` en ejecución.

---

## ⚙️ Variables de Entorno

Crea un archivo `.env` en la raíz del directorio `backend/` con las siguientes variables:

```env
# Puerto del Servidor HTTP
PORT=3000

# Configuración de Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=tu_password
DB_NAME=uml_studio_db
DB_SYNCHRONIZE=true
DB_LOGGING=false

# Configuración JWT
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d

# Inteligencia Artificial (Google Gemini)
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
```

---

## 🚀 Instalación y Ejecución

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Crear la base de datos en PostgreSQL:**
   ```sql
   CREATE DATABASE uml_studio_db;
   ```

3. **Iniciar en modo desarrollo con recarga en caliente:**
   ```bash
   npm run start:dev
   ```

4. **Compilar para producción:**
   ```bash
   npm run build
   ```

5. **Iniciar en modo producción:**
   ```bash
   npm run start:prod
   ```

---

## 📚 Documentación de la API (Swagger)

Una vez iniciado el servidor, puedes acceder a la interfaz interactiva de Swagger UI con todos los endpoints documentados:

🔗 **URL:** `http://localhost:3000/api/docs`

---

## 📂 Estructura del Código

```text
backend/
├── src/
│   ├── app.module.ts              # Módulo raíz que ensambla todos los submódulos
│   ├── main.ts                    # Punto de entrada (CORS, Swagger, Pipes globales)
│   ├── common/                    # Decoradores, filtros de excepción, guards JWT
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── config/                    # Configuraciones (database.config.ts, jwt.config.ts)
│   └── modules/                   # Módulos del dominio
│       ├── ai-assistant/
│       ├── auth/
│       ├── code-generator/
│       ├── collaboration/
│       ├── diagrams/
│       ├── projects/
│       └── xmi-interop/
├── test/                          # Tests e2e y configuraciones de prueba
├── tsconfig.json
└── package.json
```

---

## 🛠 Scripts Disponibles

* `npm run start:dev`: Inicia el servidor en modo desarrollo (`watch mode`).
* `npm run build`: Compila la aplicación a JavaScript en `dist/`.
* `npm run start:prod`: Ejecuta el build de producción desde `dist/main.js`.
* `npm run test`: Ejecuta los tests unitarios con Jest.
* `npm run lint`: Ejecuta el linter ultrarrápido con Oxlint.
* `npm run format`: Formatea el código con Prettier.
