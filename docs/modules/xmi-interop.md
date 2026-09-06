# 🔄 Módulo de Interoperabilidad XMI 2.1 y Versionado (XMI Interop Module)

## 📌 Descripción General
El **Módulo de Interoperabilidad XMI 2.1 y Versionado** proporciona el motor bidireccional para exportar e importar modelos y diagramas de clases UML entre la plataforma web colaborativa y herramientas CASE tradicionales de la industria, principalmente **Enterprise Architect v17 (Sparx Systems)**. Además, administra el versionado inmutable y snapshots históricos del Árbol de Sintaxis Abstracta (**AST**) asociados a etiquetas semánticas (`v1.0.0`, `snapshot-2026`).

A diferencia de exportadores genéricos que omiten la capa de presentación visual, este módulo genera e interpreta la sección `<xmi:Extension extender="Enterprise Architect"><diagrams><diagram><elements>` con coordenadas geométricas precisas (`Left`, `Top`, `Right`, `Bottom`), permitiendo que al abrir el archivo `.xmi` en Enterprise Architect se dibuje inmediatamente el diagrama con todas las cajas de clases, compartimentos de atributos/operaciones y líneas de relaciones en su posición exacta.

---

## 🏛 Arquitectura en 5 Capas (Backend)

```
src/modules/xmi-interop/
├── controllers/          # [Capa 1] Endpoints REST & Swagger (XmiController, DiagramVersionController)
├── services/             # [Capa 2] Motores de Serialización y Versionado (XmiExporterService, XmiParserService, XmiInteropService, DiagramVersionService)
├── repositories/         # [Capa 3] Acceso a Datos de Versionado (DiagramVersionRepository)
├── entities/             # [Capa 4] Esquema Relacional ('diagram_versions')
└── dtos/                 # [Capa 5] DTOs de Transferencia y Validación (xmi-interop.dto.ts, diagram-version.dto.ts)
```

---

## 📐 Estructura y Compatibilidad XMI 2.1 (Enterprise Architect v17)

| Componente XML / XMI | Propósito en Enterprise Architect | Detalle Técnico |
| :--- | :--- | :--- |
| `<uml:Model>` | Estructura semántica del modelo UML 2.1 | Contiene `<packagedElement>` para clases, atributos, métodos y asociaciones. |
| `<xmi:Extension>` | Metadatos propietarios de Sparx EA | Almacena configuraciones de proyecto, visibilidad, tipos de datos y tags. |
| `<elements>` | Especificación de clases y paquetes en EA | Vincula los `xmi:id` con identificadores locales y atributos detallados. |
| `<connectors>` | Enlaces y relaciones semánticas | Define origen (`source`), destino (`target`), multiplicidades y tipo (`Association`, `Generalization`, `Composition`). |
| `<primitivetypes>` | Catálogo de tipos de datos Java/UML | Define paquetes para `EAJava_uuid`, `EAJava_String`, `EAJava_int`, `EAJava_Date`, etc. |
| `<diagrams><diagram>` | **Lienzo gráfico y dibujo del diagrama** | Contiene `<elements><element geometry="Left=X;Top=Y;Right=X+W;Bottom=Y+H;" subject="EAID_..." style="DUID=HEX;"/>` |

---

## 📋 Casos de Uso del Módulo

### 🔹 CU-12. Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e Imagen

| Campo | Detalle |
| :--- | :--- |
| **Nombre de CU** | CU-12. Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e Imagen |
| **Propósito** | Proporcionar interoperabilidad completa mediante exportación e importación estándar XML XMI 2.1 con geometría `<diagrams><elements>` para Enterprise Architect v17, exportación a imagen Bitmap BMP 24-bit de alta fidelidad y control de versiones inmutables. |
| **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
| **Actor iniciador** | A1 o A2 |
| **Precondición** | Diagrama con clases modeladas en el lienzo. Para restauración de versiones, privilegios de edición. |
| **Flujo principal** | **Exportar a Enterprise Architect (.xmi 2.1):**<br>• Menú `Exportar ▾` $\rightarrow$ `Enterprise Architect (.xmi)`.<br>• El sistema genera el documento XML XMI 2.1 incluyendo modelo semántico y coordenadas exactas de dibujo.<br>• Se descarga `${diagram_name}_ea.xmi`. Al abrirlo en EA v17, el diagrama aparece dibujado automáticamente.<br><br>**Exportar Imagen Bitmap (.bmp - EA):**<br>• Menú `Exportar ▾` $\rightarrow$ `Imagen Bitmap (.bmp - EA)`.<br>• `BmpExportService` captura el DOM a resolución $2\times$, sanitiza elementos SVG y codifica la matriz de píxeles binaria BMP de 24 bits.<br>• Descarga `${diagram_name}.bmp` idéntico visualmente al canvas sin puntos negros ni manchas.<br><br>**Importar Archivo XML/XMI de Enterprise Architect:**<br>• Menú `Importar ▾` $\rightarrow$ `Cargar Archivo .xml / .xmi`.<br>• El parser extrae clases, compartimentos, multiplicidades y coordenadas `Left/Top` y reconstruye el diagrama en el lienzo.<br><br>**Gestionar Snapshots y Versiones:**<br>• Crear snapshots congelados con etiqueta semántica (ej. `v1.0.0`) y restaurar estados previos en cualquier momento. |
| **Postcondición** | Archivo `.xmi` / `.bmp` descargado, modelo externo importado o snapshot registrado en historial. |
| **Excepción** | • **XML Mal Formado:** Retorna HTTP `400 Bad Request` indicando error de parseo sin corromper el modelo activo. |

---

## 📊 Diagrama de Secuencia Mermaid: Exportación, Importación y Versionado XMI

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuario (Ingeniero de Software)
    participant UI as DiagramEditor (Angular)
    participant API as XmiController (NestJS)
    participant Srv as XmiInteropService
    participant Exp as XmiExporterService
    participant Parser as XmiParserService
    participant Repo as DiagramVersionRepository
    participant DB as PostgreSQL (diagrams, diagram_versions)

    Note over User,DB: 1. Exportación a Enterprise Architect v17 (CU-16)
    User->>UI: Clic en "Exportar -> Enterprise Architect (.xmi)"
    UI->>API: GET /api/xmi/export/:diagramId
    API->>Srv: exportDiagramToXmi(diagramId, userId)
    Srv->>Exp: exportToXmi(astData)
    Exp->>Exp: Genera <uml:Model> + <xmi:Extension> + <diagrams><elements>
    Exp-->>Srv: XML XMI 2.1 con geometrías
    Srv-->>API: { filename, xmiContent }
    API-->>UI: 200 OK (Content-Type: application/xml)
    UI-->>User: Descarga automática de "sistema_ventas_ea.xmi"

    Note over User,DB: 2. Importación de Modelo Externo (CU-17)
    User->>UI: Carga archivo "prueba.xml" de EA v17
    UI->>API: POST /api/xmi/import (ImportXmiDto)
    API->>Srv: importXmi(dto, userId)
    Srv->>Parser: parseXmi(xmlContent)
    Parser->>Parser: Extrae Classes, Attributes, Operations, Relations, Coordinates (Left, Top)
    Parser-->>Srv: DiagramAstData estructurado
    Srv->>DB: Guarda AST en BD (diagrams, nodes, connections)
    Srv-->>API: AST parseado
    API-->>UI: 200 OK con AST completo
    UI->>UI: Renderiza clases y relaciones en lienzo Foblex Flow

    Note over User,DB: 3. Creación de Snapshot / Versión (CU-18)
    User->>UI: Guarda versión "v1.2.0"
    UI->>API: POST /api/xmi/diagrams/:id/versions
    API->>Srv: createDiagramVersion(diagramId, dto, userId)
    Srv->>Exp: exportToXmi(astJson)
    Srv->>Repo: createVersion({ diagramId, versionTag, astJson, xmiContent })
    Repo->>DB: INSERT INTO diagram_versions ...
    DB-->>Repo: Registro creado
    Srv-->>API: DiagramVersionResponseDto
    API-->>UI: 201 Created
```

---

## 🧪 Casos de Prueba (Test Cases)

| ID Caso de Prueba | Caso de Uso | Descripción / Escenario | Precondiciones | Datos de Entrada | Pasos de Ejecución | Resultado Esperado | Resultado Real | Estado |
|---|---|---|---|---|---|---|---|:---:|
| **TC_CU12_01** | CU-12 | Exportación XMI 2.1 con clases, atributos y métodos (Camino feliz) | Diagrama activo con clases en BD | `diagramId`: "diag-1" | 1. Solicitar `GET /api/xmi/export/diag-1`.<br>2. Validar respuesta XML. | Genera XML XMI 2.1 con `<uml:Model>`, `<packagedElement xmi:type="uml:Class">` y tipos de atributos. | Archivo XMI 2.1 generado con estructura completa de clases y operaciones. | **Aprobado (Pass)** |
| **TC_CU12_02** | CU-12 | Inclusión de sección `<diagrams>` con coordenadas exactas para EA v17 | Clases posicionadas en (x:100, y:150) | `diagramId`: "diag-1" | 1. Exportar XMI.<br>2. Buscar tag `<diagrams>`. | Contiene `<element geometry="Left=100;Top=150;Right=320;Bottom=290;" subject="EAID_..." style="DUID=...;"/>`. | Geometría exacta generada para renderizado automático en EA v17. | **Aprobado (Pass)** |
| **TC_CU12_03** | CU-12 | Exportación de relaciones y multiplicidades UML (Composición, Agregación, etc.) | Clases conectadas con relación 1:N | Relación `composition`, sMult: "1", tMult: "0..*" | 1. Exportar XMI.<br>2. Inspeccionar `<connectors>`. | Conector generado con `aggregation="composite"`, `lb="1"`, `rb="0..*"`. | Conectores y multiplicidades exportadas en `<connectors>` y `<packagedElement>`. | **Aprobado (Pass)** |
| **TC_CU12_04** | CU-12 | Exportación de imagen Bitmap 24-bit sin manchas ni distorsiones (Camino feliz) | Diagrama con clases y relaciones en canvas | Menú `Exportar ▾ -> Imagen Bitmap (.bmp - EA)` | 1. Abrir menú Exportar.<br>2. Clic en "Imagen Bitmap (.bmp - EA)". | Descarga archivo `.bmp` 24 bits con resolución 2x idéntico a la vista del editor. | Archivo `.bmp` descargado y verificado en visor de imágenes. | **Aprobado (Pass)** |
| **TC_CU12_05** | CU-12 | Parseo exitoso de archivo `prueba.xml` exportado desde EA v17 (Camino feliz) | Archivo XML válido de EA v17 | Contenido de `prueba.xml` | 1. Ejecutar `xmiParserService.parseXmi(xml)`. | Extrae tablas `users`, `users - Copy`, `users - Copy1` con sus coordenadas `(54, 21)` y `(55, 246)`. | Nodos, atributos, métodos y posiciones extraídas fielmente. | **Aprobado (Pass)** |
| **TC_CU12_06** | CU-12 | Importación XMI con guardado persistente en base de datos (Camino feliz) | Usuario con rol EDITOR en proyecto | `xmiContent`, `projectId`: "proj-1" | 1. POST `/api/xmi/import`. | Crea diagrama en base de datos e inserta nodos y conexiones relacionales. | Diagrama creado y retornado con ID asignado. | **Aprobado (Pass)** |
| **TC_CU12_07** | CU-12 | Validación de contenido XML vacío o corrupto | Entrada inválida | `xmiContent`: "" | 1. POST `/api/xmi/import` con body vacío. | Retorna error HTTP 400 Bad Request con mensaje descriptivo. | Excepción `BadRequestException` lanzada y controlada. | **Aprobado (Pass)** |
| **TC_CU12_08** | CU-12 | Creación de versión snapshot inmutable (Camino feliz) | Diagrama existente en BD | `versionTag`: "v1.0.0" | 1. POST `/api/xmi/diagrams/:id/versions`. | Crea registro en `diagram_versions` con AST y XMI congelado. | Registro persistido con ID y timestamp de creación. | **Aprobado (Pass)** |
| **TC_CU12_09** | CU-12 | Listado cronológico de versiones de un diagrama (Camino feliz) | Diagrama con versiones previas | `diagramId`: "diag-1" | 1. GET `/api/xmi/diagrams/:id/versions`. | Retorna array de versiones ordenado descendentemente por fecha. | Lista de versiones retornada con nombres de creadores y tags. | **Aprobado (Pass)** |
| **TC_CU12_10** | CU-12 | Restauración de diagrama a una versión histórica (Camino feliz) | Versión existente "v1.0.0" | `versionId`: "ver-1" | 1. POST `/api/xmi/diagrams/:id/versions/ver-1/restore`. | Sobrescribe el AST activo con el AST congelado en la versión. | Diagrama actualizado en base de datos y retornado para refresco en frontend. | **Aprobado (Pass)** |

---

## 🔌 Especificación de Endpoints REST

| Método | Ruta | Seguridad | Roles Permitidos | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/xmi/export/:diagramId` | Bearer JWT | Todos los miembros | Descarga el archivo `.xmi` (XMI 2.1) con soporte de dibujo para EA v17 |
| `POST` | `/api/xmi/export-ast` | Bearer JWT | Todos los miembros | Exporta directamente un AST JSON a XMI 2.1 para descarga en caliente |
| `POST` | `/api/xmi/import` | Bearer JWT | `OWNER`, `EDITOR` | Importa y parsea un archivo XMI/XML 2.1 (crea o actualiza en BD si se indica) |
| `POST` | `/api/xmi/diagrams/:diagramId/versions` | Bearer JWT | `OWNER`, `EDITOR` | Crea un snapshot/versión congelada del diagrama con su AST y XMI |
| `GET` | `/api/xmi/diagrams/:diagramId/versions` | Bearer JWT | Todos los miembros | Lista todas las versiones históricas del diagrama |
| `GET` | `/api/xmi/diagrams/:diagramId/versions/:versionId` | Bearer JWT | Todos los miembros | Obtiene los detalles y el XMI de una versión histórica |
| `POST` | `/api/xmi/diagrams/:diagramId/versions/:versionId/restore` | Bearer JWT | `OWNER`, `EDITOR` | Restaura el estado activo del diagrama al AST de la versión indicada |
