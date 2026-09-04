# 📋 Tabla Consolidada de Casos de Uso del Sistema

## 👥 Actores del Sistema

| Código | Actor | Rol / Descripción |
| :---: | :--- | :--- |
| **A1** | **Ingeniero Anfitrión (OWNER)** | Crea el proyecto, configura paquetes base (`com.empresa.app`), versiones de plataforma (Java/Spring Boot), gestiona colaboradores y administra permisos del espacio de trabajo. |
| **A2** | **Ingeniero Colaborador (EDITOR / VIEWER)** | Modifica el diagrama UML en tiempo real (en rol `EDITOR`), adquiere bloqueos de exclusión mutua, inspecciona modelos en modo lectura (en rol `VIEWER`), ejecuta exportaciones y descarga artefactos. |
| **A3** | **Agente IA (Gemini)** | Interpreta comandos de voz/texto y visión computacional de diagramas para generar mutaciones JSON estructuradas del AST y coordinar bloqueos concurrentes. |

---

## 📊 Matriz Refactorizada de Casos de Uso

| ID | CASO DE USO | ACTOR | PRIORIDAD |
| :---: | :--- | :---: | :---: |
| **CU-01** | Gestión de Autenticación y Sesión de Usuario | **A1, A2** | `ALTA` |
| **CU-02** | Gestión de Proyectos | **A1** | `ALTA` |
| **CU-03** | Gestión de Miembros y Roles | **A1** | `ALTA` |
| **CU-04** | Gestión de Clases y Estructura Interna (Atributos y Métodos) | **A1, A2** | `ALTA` |
| **CU-05** | Gestión de Relaciones y Conectores UML | **A1, A2** | `ALTA` |
| **CU-06** | Sincronización de Presencia, Cursores y Mutaciones del Diagrama | **A1, A2, A3** | `ALTA` |
| **CU-07** | Exclusión Mutua y Bloqueo de Tablas para Edición Segura | **A1, A2, A3** | `ALTA` |
| **CU-08** | Exportación e Importación Interoperable | **A1, A2** | `BAJA` |
| **CU-10** | Asistente IA por Comandos de Texto y Voz | **A1, A2, A3** | `MEDIA` |
| **CU-11** | Asistente IA por Digitalización de Imagen | **A1, A2, A3** | `MEDIA` |
| **CU-12** | Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e Imagen | **A1, A2** | `ALTA` |
| **CU-13** | Vista Previa de Arquitectura Fullstack en Vivo | **A1, A2** | `MEDIA` |
| **CU-14** | Compilación y Descarga del Proyecto Fullstack en ZIP | **A1, A2** | `ALTA` |

---

## 📝 Descripción Detallada de los Casos de Uso

### 🔐 1. Módulo de Autenticación (`auth.md`)
* **CU-01: Gestión de Autenticación y Sesión de Usuario**
  * **Actores:** `A1, A2` | **Prioridad:** `ALTA`
  * **Descripción:** Gestiona el ciclo completo de identidad de los ingenieros, incluyendo registro de nuevas cuentas, validación de credenciales con hash criptográfico `bcrypt` (10 rounds), emisión de tokens de acceso JWT (expiración de 7 días), protección de rutas mediante `JwtAuthGuard` y consulta segura del perfil activo con `@CurrentUser()`.

---

### 📁 2. Módulo de Proyectos y Equipos (`projects.md`)
* **CU-02: Gestión de Proyectos**
  * **Actores:** `A1` | **Prioridad:** `ALTA`
  * **Descripción:** Permite al ingeniero anfitrión crear espacios de trabajo definiendo la configuración técnica base (`com.empresa.app`, Java 17/21, Spring Boot 4), inicializar automáticamente el diagrama principal, actualizar metadatos del proyecto y realizar la eliminación en cascada de todos sus recursos vinculados.
* **CU-03: Gestión de Miembros y Roles**
  * **Actores:** `A1` | **Prioridad:** `ALTA`
  * **Descripción:** Permite al anfitrión invitar colaboradores por correo institucional, asignar roles basados en permisos (`EDITOR` o `VIEWER`), alternar privilegios en caliente y revocar accesos al espacio de trabajo.

---

### 📊 3. Módulo de Diagramas UML (`diagrams.md`)
* **CU-04: Gestión de Clases y Estructura Interna (Atributos y Métodos)**
  * **Actores:** `A1, A2` | **Prioridad:** `ALTA`
  * **Descripción:** Permite la creación visual, posicionamiento $(X, Y)$, redimensionamiento y eliminación de clases sobre el lienzo interactivo, junto con la edición in-situ de atributos tipados fuertemente para backend/SQL (`UUID`, `String`, `Integer`, `Double`, `LocalDate`, etc.) y métodos con parámetros y tipos de retorno.
* **CU-05: Gestión de Relaciones y Conectores UML**
  * **Actores:** `A1, A2` | **Prioridad:** `ALTA`
  * **Descripción:** Permite establecer conexiones semánticas UML 2.5 entre clases (Asociación, Generalización con triángulo blanco, Realización discontinua, Composición con rombo negro, Agregación con rombo blanco, Dependencia) y la creación geométrica de Clases de Asociación N:M con cálculo de punto medio.
* **CU-08: Exportación e Importación Interoperable**
  * **Actores:** `A1, A2` | **Prioridad:** `BAJA`
  * **Descripción:** Permite la persistencia del Árbol de Sintaxis Abstracta (AST) en PostgreSQL (`Ctrl+S`), la descarga del archivo de definición en formato JSON y la importación de archivos JSON externos para restaurar o transferir diagramas.

---

### 🤝 4. Módulo de Colaboración en Tiempo Real (`collaboration.md`)
* **CU-06: Sincronización de Presencia, Cursores y Mutaciones del Diagrama**
  * **Actores:** `A1, A2, A3` | **Prioridad:** `ALTA`
  * **Descripción:** Conecta a los participantes mediante WebSockets (Socket.IO), mostrando avatares activos, transmitiendo la posición de los cursores del ratón en tiempo real (~40 FPS) con etiquetas de color, y difundiendo instantáneamente todas las mutaciones del lienzo tanto a editores como a usuarios en modo espectador (`VIEWER`).
* **CU-07: Exclusión Mutua y Bloqueo de Tablas para Edición Segura**
  * **Actores:** `A1, A2, A3` | **Prioridad:** `ALTA`
  * **Descripción:** Adquiere un bloqueo distribuido exclusivo (*Node-Level Locking*) cuando un usuario o el asistente IA abren una clase para edición, señalizándolo visualmente a los demás colaboradores con un contorno de color y cursor bloqueado para evitar colisiones y sobreescrituras destructivas.

---

### ✨ 5. Módulo de Asistente Copilot IA (`ai-assistant.md`)
* **CU-10: Asistente IA por Comandos de Texto y Voz**
  * **Actores:** `A1, A2, A3` | **Prioridad:** `MEDIA`
  * **Descripción:** Interpreta comandos en lenguaje natural ingresados por teclado o dictados por voz (mediante Web Speech API), procesando las solicitudes con Gemini 2.5 Flash para emitir el AST estructurado en JSON, sanitizar tipos de datos y aplicar mutaciones directamente sobre el canvas.
* **CU-11: Asistente IA por Digitalización de Imagen**
  * **Actores:** `A1, A2, A3` | **Prioridad:** `MEDIA`
  * **Descripción:** Procesa capturas de pantalla, fotos de pizarras o bocetos en papel mediante visión computacional multimodal (Gemini Vision), reconociendo entidades, atributos, métodos y multiplicidades para reconstruir el modelo interactivo en Foblex Flow.

---

### 🔄 6. Módulo de Interoperabilidad XMI e Imagen (`xmi-interop.md`)
* **CU-12: Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e Imagen**
  * **Actores:** `A1, A2` | **Prioridad:** `ALTA`
  * **Descripción:** Permite exportar el modelo a XML XMI 2.1 con geometrías completas `<diagrams><elements>` para Enterprise Architect v17, importar modelos XMI/XML externos, capturar y descargar imágenes en formato Windows Bitmap de 24 bits (`.bmp`) en resolución $2\times$ sin artefactos, y gestionar snapshots inmutables del diagrama.

---

### ⚡ 7. Módulo Generador de Código Fullstack (`code-generator.md`)
* **CU-13: Vista Previa de Arquitectura Fullstack en Vivo**
  * **Actores:** `A1, A2` | **Prioridad:** `MEDIA`
  * **Descripción:** Proporciona un visor interactivo clasificado por capas para inspeccionar los archivos generados antes de su descarga, cubriendo tanto la arquitectura en capas de Spring Boot 4 como la arquitectura limpia (Clean Architecture + BLoC) de Flutter.
* **CU-14: Compilación y Descarga del Proyecto Fullstack en ZIP**
  * **Actores:** `A1, A2` | **Prioridad:** `ALTA`
  * **Descripción:** Compila y empaqueta en memoria la solución completa: backend Spring Boot 4 (Entidades JPA, Repositorios, DTOs, Servicios, Controladores REST, Swagger, migraciones Flyway, `docker-compose.yml`) y frontend móvil Flutter (Data, Domain, Presentation, GetIt, BLoC, Android & Linux runner) comprimidos en un único archivo `.zip`.
