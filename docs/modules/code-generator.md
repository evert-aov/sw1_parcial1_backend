# 🚀 Módulo de Generación de Código Fullstack: Spring Boot 4 & Flutter Mobile App

## 📌 Descripción General
El **Módulo de Generación de Código** transforma el Árbol de Sintaxis Abstracta (**AST**) de diagramas de clases UML y modelos entidad-relación en soluciones de software completas, desacopladas y listas para producción:

1. **Backend REST Microservice:** Desarrollado en **Spring Boot 3.4.0 / 4 + Java 21 + PostgreSQL 16**, con arquitectura limpia en 5 capas, migraciones Flyway (`V1__create_tables.sql`), contenedor `Dockerfile` multi-stage, orquestación con `docker-compose.yml` y documentación interactiva **Swagger UI** en `/swagger-ui.html`.
2. **Frontend Móvil Multiplataforma:** Desarrollado en **Flutter (Dart)** siguiendo **Clean Architecture**, con gestor de estado **BLoC** (`flutter_bloc`), cliente HTTP **Dio** con interceptores de logging y reintentos, programación funcional con **Dartz** (`Either<Failure, T>`), inyección de dependencias con **GetIt** (`injection_container.dart`), y soporte para consumo local vía cable USB (`adb reverse tcp:8080 tcp:8080`) o emulador (`10.0.2.2`).

---

## 🏛 Arquitectura en 5 Capas (Backend Spring Boot)

```text
backend/src/modules/code-generator/
├── controllers/          # [Capa 1] Endpoints REST & Swagger (CodeGeneratorController)
├── services/             # [Capa 2] Motores de Compilación (SpringTemplateEngineService, FlutterTemplateEngineService, ZipArchiverService)
├── templates/            # [Capa 3] Plantillas de Renderizado Java, SQL, YAML, XML, Docker y Flutter
│   ├── flutter/          # Plantillas de Clean Architecture Dart (Core, Entity, Model, DataSource, Repo, UseCases, BLoC, UI)
│   ├── entity.template.ts
│   ├── repository.template.ts
│   ├── dto.template.ts
│   ├── service.template.ts
│   └── controller.template.ts
├── entities/             # [Capa 4] Modelos de Dominio y AST
└── dtos/                 # [Capa 5] DTOs de Solicitud y Vista Previa (GenerateCodeRequestDto, CodeGenerationPreviewResponseDto)
```

---

## 📱 Arquitectura Limpia en Flutter (Clean Architecture + BLoC)

```text
lib/
├── core/
│   ├── constants/
│   │   └── api_constants.dart          # URLs base, timeouts y endpoints REST (con soporte para localhost / 10.0.2.2 / USB host)
│   ├── errors/
│   │   ├── exceptions.dart             # ServerException, NetworkException, NotFoundException
│   │   └── failures.dart               # Failure, ServerFailure, NetworkFailure, NotFoundFailure
│   ├── network/
│   │   └── api_client.dart             # Instancia de Dio con interceptores y logging
│   └── theme/
│       └── app_theme.dart              # Colores, tipografía y estilos globales Material 3
│
├── features/                           # Un módulo independiente por cada entidad del diagrama UML
│   ├── [entidad]/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   └── [entidad]_remote_datasource.dart
│   │   │   ├── models/
│   │   │   │   ├── [entidad]_model.dart          # Serialización JSON (fromJson / toJson)
│   │   │   │   └── [entidad]_request_model.dart  # DTOs de solicitud para Create / Update
│   │   │   └── repositories/
│   │   │       └── [entidad]_repository_impl.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── [entidad]_entity.dart         # Entidad pura inmutable de Dart (Equatable)
│   │   │   ├── repositories/
│   │   │   │   └── [entidad]_repository.dart     # Contrato de repositorio con Either<Failure, T>
│   │   │   └── usecases/
│   │   │       ├── get_[entidades]_usecase.dart
│   │   │       ├── get_[entidad]_by_id_usecase.dart
│   │   │       ├── create_[entidad]_usecase.dart
│   │   │       ├── update_[entidad]_usecase.dart
│   │   └── presentation/
│   │       ├── bloc/
│   │       │   ├── [entidad]_bloc.dart           # Máquina de estados reactiva BLoC
│   │       │   ├── [entidad]_event.dart
│   │       │   └── [entidad]_state.dart
│   │       ├── pages/
│   │       │   ├── [entidad]_list_page.dart      # Lista con Pull-to-Refresh y Card actions
│   │       │   └── [entidad]_form_page.dart      # Formulario reactivo de creación y edición
│   │       └── widgets/
│   │           └── [entidad]_card_widget.dart
│
├── injection_container.dart            # Service Locator GetIt (sl)
└── main.dart                           # Inicialización, MultiBlocProvider y MaterialApp
```

---

## 📋 Casos de Uso del Módulo

### 🔹 CU-13: Vista Previa de Arquitectura Fullstack en Vivo
* **Actor Principal:** `A1, A2` (Ingeniero Anfitrión / Ingeniero Colaborador).
* **Prioridad:** `MEDIA`
* **Descripción:** Permite inspeccionar en tiempo real todos los archivos generados tanto para Spring Boot como para Flutter antes de descargarlos.
* **Flujo Principal:**
  1. El usuario hace clic en el botón `⚡ Generador Fullstack` en el editor.
  2. El frontend envía la solicitud a `POST /api/codegen/preview/:diagramId` o `POST /api/codegen/preview-ast`.
  3. Los motores `SpringTemplateEngineService` y `FlutterTemplateEngineService` compilan el AST y retornan la lista de archivos organizados por carpetas y capas.
  4. El modal interactivo presenta un explorador de archivos con filtros (*Entidades*, *Repositorios*, *DTOs*, *Servicios*, *Controladores*, *BLoC*, *Flutter Pages*, *Flyway*, *Docker*).

---

### 🔹 CU-14: Compilación y Descarga del Proyecto Fullstack en ZIP
* **Actor Principal:** `A1, A2` (Ingeniero Anfitrión / Ingeniero Colaborador).
* **Prioridad:** `ALTA`
* **Descripción:** Genera y empaqueta en memoria la estructura completa del proyecto Maven/Spring Boot y Flutter Mobile en un archivo `.zip` comprimido, incluyendo la configuración para ejecución en local, contenedores Docker y depuración móvil vía cable USB.
* **Flujo Principal (Descarga y Empaquetado):**
  1. El usuario presiona el botón `📦 Descargar Solución Fullstack (.zip)`.
  2. El backend empaqueta en memoria `backend/` (Spring Boot + PostgreSQL + Flyway + Docker) y `mobile_flutter/` (Clean Architecture + BLoC + GetIt + Dio + Runner Android/Linux) con `ZipArchiverService`.
  3. El navegador descarga automáticamente el archivo `${artifact_name}.zip` listo para descomprimir y ejecutar.
* **Flujo de Ejecución y Conexión USB:**
  1. El usuario levanta el backend con `cd backend && docker compose up --build`.
  2. Conecta el teléfono Android por cable USB y ejecuta `adb reverse tcp:8080 tcp:8080`.
  3. Inicia la app móvil con `cd mobile_flutter && flutter run`.
  4. La aplicación Flutter se comunica instantáneamente con `http://localhost:8080/api/v1` a través del túnel USB.

---

## 📊 Diagrama de Secuencia Mermaid: Generación Fullstack y Consumo Móvil USB

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Desarrollador (Ingeniero)
    participant UI as DiagramEditor (Angular)
    participant Modal as SpringBootModalComponent
    participant API as CodeGeneratorController (NestJS)
    participant Srv as CodeGeneratorService
    participant SpringEngine as SpringTemplateEngineService
    participant FlutterEngine as FlutterTemplateEngineService
    participant Archiver as ZipArchiverService
    actor Mobile as App Flutter (Android USB)

    Note over Dev,API: 1. Inspección y Descarga Fullstack (CU-19, CU-20)
    Dev->>UI: Clic en "⚡ Generador Fullstack (Spring Boot + Flutter)"
    UI->>Modal: Abre modal de configuración
    Modal->>API: POST /api/codegen/preview-ast (GenerateCodeRequestDto)
    API->>Srv: previewFromAst(dto)
    Srv->>SpringEngine: generateProjectFiles() -> backend/
    Srv->>FlutterEngine: generateFlutterProjectFiles() -> mobile_flutter/
    Srv-->>API: 50+ archivos generados
    API-->>Modal: 200 OK (Árbol y Visor de Código)
    Dev->>Modal: Clic en "📦 Descargar Solución Fullstack (.zip)"
    Modal->>API: POST /api/codegen/download-ast
    API->>Archiver: createZipBuffer()
    Archiver-->>API: Buffer binario ZIP
    API-->>Modal: 200 OK (Content-Type: application/zip)
    Modal-->>Dev: Descarga automática de "proyecto-fullstack.zip"

    Note over Dev,Mobile: 2. Despliegue Backend y Consumo Móvil Vía USB (CU-21)
    Dev->>Dev: Inicia backend: `cd backend && docker compose up --build`
    Dev->>Dev: Configura reenvío USB: `adb reverse tcp:8080 tcp:8080`
    Dev->>Mobile: Inicia Flutter: `cd mobile_flutter && flutter run`
    Mobile->>API: HTTP GET /api/v1/clientes (a través de Dio y túnel USB)
    API-->>Mobile: 200 OK [ { id, nombre, telefono, saldo } ]
    Mobile-->>Dev: Renderiza lista reactiva BLoC en pantalla del celular
```

---

## 🧪 Resumen de Pruebas Unitarias

* **`FlutterTemplateEngineService`:** Valida la generación correcta de Entidades Dart, Modelos JSON, Request DTOs, Remote DataSources, Repositorios con Dartz, UseCases, BLoCs, Pages, Widgets, Inyección de dependencias GetIt y `pubspec.yaml`.
* **`SpringTemplateEngineService`:** Valida las 5 capas de Spring Boot, Flyway SQL, Swagger OpenAPI, Dockerfile y docker-compose.
* **`CodeGeneratorService` & `CodeGeneratorController`:** Valida los endpoints de vista previa y descarga ZIP para plataformas `all`, `spring-boot` y `flutter`.
* **Resultado:** **19 Test Suites pasadas, 85/85 tests unitarios aprobados al 100%** ✅.
