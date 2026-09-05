# ✨ Módulo de Asistente Inteligente UML (AI Assistant - Vertex AI Gemini 2.5 Flash)

## 📌 Descripción General
El **Módulo de Asistente IA (Copilot UML)** integra **Google Cloud Vertex AI** mediante el SDK oficial `@google/genai` (utilizando el modelo multimodal **`gemini-2.5-flash`**). Permite interactuar mediante texto en lenguaje natural, dictado por voz y digitalización óptica de imágenes de diagramas UML (pizarras, bocetos o capturas), sincronizando las mutaciones estructurales del canvas en tiempo real vía WebSockets como un colaborador activo más.

---

## 🏛 Arquitectura en 5 Capas (Backend)

```
src/modules/ai-assistant/
├── controllers/          # [Capa 1] Controladores REST & Swagger (AiAssistantController)
├── services/             # [Capa 2] Lógica de Prompts, Guardrails y Difusión (AiAssistantService, VertexAiService)
├── repositories/         # [Capa 3] Acceso a Gateways de Colaboración (CollaborationGateway)
├── entities/             # [Capa 4] Interfaces de Mutación del AST ('UmlClassNode', 'UmlConnection')
└── dtos/                 # [Capa 5] DTOs de Entrada y Salida (AiPromptDto, AiVisionPromptDto, AiResponseDto)
```

---

## 🛡️ Guardrails y Políticas del Asistente IA
1. **Regla de Guardrail Estricta:** El asistente **NO** inventa modelos de negocio genéricos o ambiguos desde cero si el usuario solo narra una historia general (ej: *"este es mi negocio de ventas... hazme el diagrama"*). Si el usuario no proporciona tablas, atributos o relaciones concretas, el asistente responde con `isClarificationRequired: true`, solicitando amablemente especificaciones estructurales o la imagen del diagrama.
2. **Tipos de Datos Fuertemente Validados:** Todo atributo generado debe pertenecer a los tipos predefinidos compatibles con Spring Boot / SQL (`UUID`, `String`, `Integer`, `Long`, `Boolean`, `Double`, `Float`, `BigDecimal`, `LocalDate`, `LocalDateTime`, `Date`, `Text`, `byte[]`).
3. **Co-edición en Tiempo Real:** Toda mutación aprobada por la IA se difunde inmediatamente mediante `CollaborationGateway` al canal `diagram_${diagramId}` con el usuario `✨ Copilot IA (Vertex AI)`, notificando a los demás colaboradores en vivo.

---

## 📋 Casos de Uso del Módulo

### 🔹 CU-10. Asistente IA por Comandos de Texto y Voz

| Campo | Detalle |
| :--- | :--- |
| **Nombre de CU** | CU-10. Asistente IA por Comandos de Texto y Voz |
| **Propósito** | Interpretar comandos en lenguaje natural ingresados por teclado o dictados por voz mediante Web Speech API, procesando las solicitudes con el motor Gemini 2.5 Flash para mutar el diagrama UML y difundir los cambios en vivo a los colaboradores. |
| **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
| **Actor iniciador** | A1 o A2 |
| **Precondición** | Diagrama abierto con permisos de edición y backend conectado a Google Cloud Vertex AI / Gemini. |
| **Flujo principal** | **Ejecutar Comando de Texto:**<br>• El usuario escribe en el panel IA: *"Crea una tabla Producto con id UUID, nombre String, precio Double y conéctala con Categoria con relación muchos a uno"*.<br>• El frontend envía `POST /api/ai/prompt` con el texto y el contexto AST actual.<br>• Gemini 2.5 Flash genera la estructura JSON con tipos sanitizados y coordenadas sin solapamiento.<br>• El backend difunde `diagram_synced` y responde HTTP `200 OK`; el canvas se actualiza en vivo.<br><br>**Ejecutar Dictado por Voz:**<br>• Clic en botón de micrófono `🎙️`.<br>• La Web Speech API captura la voz en tiempo real y transcribe el audio al área de texto.<br>• El usuario envía el comando y Gemini aplica la transformación sobre el diagrama.<br><br>**Guardrail de Ambigüedad:**<br>• Si el comando es una historia vaga sin entidades concretas, la IA orienta al usuario sin mutar el canvas. |
| **Postcondición** | Clases y relaciones generadas por IA renderizadas en pantalla y registradas en el historial de mutaciones. |
| **Excepción** | • **Error de Reconocimiento de Voz / Micrófono:** Alerta de permisos en navegador.<br>• **Falla de API Vertex AI:** Notificación de error y reintento sin corrupción de datos. |

---

### 🔹 CU-11. Asistente IA por Digitalización de Imagen

| Campo | Detalle |
| :--- | :--- |
| **Nombre de CU** | CU-11. Asistente IA por Digitalización de Imagen |
| **Propósito** | Digitalizar automáticamente bocetos a mano alzada, fotos de pizarras o capturas de pantalla de diagramas UML mediante visión computacional multimodal (Gemini Vision) para convertirlos en clases y relaciones interactivas. |
| **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
| **Actor iniciador** | A1 o A2 |
| **Precondición** | Archivo de imagen válido (`.png`, `.jpg`, `.webp`) y conexión activa con Gemini Vision. |
| **Flujo principal** | **Cargar Imagen de Diagrama:**<br>• Clic en botón `🖼️` del panel Copilot IA y seleccionar fotografía o boceto.<br>• El panel presenta la miniatura de la imagen cargada.<br><br>**Procesar Visión Computacional:**<br>• Clic en "Digitalizar Diagrama con IA".<br>• El frontend envía `POST /api/ai/vision-diagram` con la imagen en Base64.<br>• Gemini 2.5 Flash analiza visualmente las formas geométricas, textos, compartimentos y flechas.<br>• El backend extrae los nodos con atributos/métodos tipados y conexiones con multiplicidades.<br><br>**Renderizado y Difusión en Vivo:**<br>• El backend devuelve los elementos estructurados y difunde `diagram_synced` a todos los clientes.<br>• El lienzo de Foblex Flow dibuja fielmente el diagrama digitalizado listo para edición continua. |
| **Postcondición** | Imagen digitalizada convertida en entidades interactivas Foblex Flow en el canvas. |
| **Excepción** | • **Imagen Ilegible / Sin Diagrama:** Notificación indicando que no se detectaron clases UML legibles.<br>• **Archivo Demasiado Pesado:** Validación de tamaño máximo de carga en cliente. |

---

## 📊 Diagrama de Secuencia Mermaid: Asistente IA Multimodal (Texto, Voz, Imagen)

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuario (Editor)
    participant UI as Copilot Panel (Angular)
    participant API as AiAssistantController (NestJS)
    participant Srv as AiAssistantService
    participant VAI as VertexAiService (Google Cloud)
    participant WS as CollaborationGateway (/collaboration)
    actor Collab as Colaborador B (En vivo)

    Note over User,VAI: 1. Comando de Texto o Dictado por Voz (CU-12, CU-13)
    User->>UI: Dicta o escribe "Crea Producto con id UUID y precio Double"
    UI->>API: POST /api/ai/prompt (AiPromptDto + Contexto AST)
    API->>Srv: processTextPrompt(dto)
    Srv->>VAI: generateContent(systemInstruction, contents, schema: JSON)
    VAI-->>Srv: JSON con nueva clase "Producto" y tipos sanitizados
    Srv->>WS: diagram_synced (nodes, connections, userId: 'ai_copilot')
    WS-->>Collab: diagram_synced (Renderiza tabla en tiempo real)
    Srv-->>API: AiResponseDto (success: true)
    API-->>UI: 200 OK
    UI->>UI: Renderiza cambios en el canvas y agrega a historial

    Note over User,VAI: 2. Digitalización por Imagen (CU-14)
    User->>UI: Adjunta foto de diagrama en pizarra (.png)
    UI->>API: POST /api/ai/vision-diagram (imageBase64 + mimeType)
    API->>Srv: processVisionDiagram(dto)
    Srv->>VAI: generateContent(Multimodal: Image InlineData + Prompt)
    VAI-->>Srv: Clases y relaciones extraídas de la imagen
    Srv->>WS: diagram_synced (Nuevas clases extraídas)
    WS-->>Collab: diagram_synced (Actualiza canvas de todos los usuarios)
    Srv-->>API: AiResponseDto (vision_extract)
    API-->>UI: 200 OK (Muestra resumen de digitalización)
```

---

## 🧪 Casos de Prueba (Test Cases)

| ID Caso de Prueba | Caso de Uso | Descripción / Escenario | Precondiciones | Datos de Entrada | Pasos de Ejecución | Resultado Esperado | Resultado Real | Estado |
|---|---|---|---|---|---|---|---|:---:|
| **TC_CU10_01** | CU-10 | Creación de tabla y relación mediante comando de texto claro (Camino feliz) | Editor abierto con permisos de edición | `prompt`: "Crea una tabla Producto con id UUID, nombre String, precio Double y conéctala con Categoria con multiplicidad *" | 1. Ingresar texto en panel IA.<br>2. Clic "Ejecutar Comando IA". | Código HTTP `200 OK`, tabla Producto creada con 3 atributos tipados y relación trazada hacia Categoria. | Vertex AI retorna JSON estructurado, canvas actualizado y difundido vía WebSockets. | **Aprobado (Pass)** |
| **TC_CU10_02** | CU-10 | Guardrail: Rechazo de modelo de negocio vago sin estructura (Flujo alterno) | Editor abierto | `prompt`: "Hola, este es mi negocio de compra venta... hazme un diagrama entero" | 1. Ingresar historia de negocio genérica.<br>2. Clic "Ejecutar Comando IA". | Código HTTP `200 OK` con `success: false` y alerta: "⚠️ Por favor especifica las tablas y atributos concretos...". | Guardrail activado; el diagrama no sufre mutaciones erráticas y se orienta al usuario. | **Aprobado (Pass)** |
| **TC_CU10_03** | CU-10 | Dictado de comando por voz mediante Web Speech API (Camino feliz) | Navegador con soporte Web Speech y micrófono habilitado | Audio dictado: "Agrega la clase FacturaDetalle con cantidad Integer y precio_unitario Double" | 1. Clic en botón de micrófono `🎙️`.<br>2. Dictar comando por voz.<br>3. Enviar prompt. | La voz se transcribe en tiempo real al cuadro de texto y Vertex AI genera la clase FacturaDetalle. | Texto capturado con precisión; mutación aplicada al lienzo. | **Aprobado (Pass)** |
| **TC_CU10_04** | CU-10 | Difusión en vivo de la mutación de IA hacia los demás colaboradores (Camino feliz) | Dos usuarios conectados en la misma sala de diagrama | Usuario A ejecuta comando de IA en su navegador | 1. Usuario A aplica mutación con Copilot IA. | En la pantalla de Usuario B, las nuevas clases y conexiones aparecen automáticamente en tiempo real. | Evento `diagram_synced` emitido por el Gateway; ambos usuarios sincronizados al instante. | **Aprobado (Pass)** |
| **TC_CU11_01** | CU-11 | Digitalización visual de diagrama UML desde imagen (Camino feliz) | Imagen válida de diagrama en pizarra o captura | Archivo `diagrama_pizarra.png` (Base64) | 1. Clic en botón `🖼️`.<br>2. Seleccionar imagen.<br>3. Clic "Digitalizar Imagen con IA". | Código HTTP `200 OK`, clases y relaciones detectadas en la foto son transformadas a nodos interactivos Foblex Flow. | Gemini Vision extrae las clases con sus compartimentos y las dibuja en el canvas. | **Aprobado (Pass)** |

---

## 🔌 Especificación de Endpoints REST

| Método | Ruta | Seguridad | HTTP Status | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/ai/prompt` | Bearer JWT | `200 OK` | Procesa un comando de texto o dictado por voz para mutar el diagrama UML con Vertex AI |
| `POST` | `/api/ai/vision-diagram` | Bearer JWT | `200 OK` | Digitaliza y extrae un diagrama UML completo a partir de una imagen usando Gemini Vision |
| `POST` | `/api/ai/audio-prompt` | Bearer JWT | `200 OK` | Procesa un comando transcrito por audio/voz para mutar el diagrama UML |

---

## 📦 Data Transfer Objects (DTOs)

### 1. `AiPromptDto`
```typescript
export class AiPromptDto {
  @ApiProperty({ example: 'Crea una tabla Producto con id UUID, nombre String, precio Double' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({ example: 'd9b736b4-2b62-4217-a068-d0a5180f9702' })
  @IsString()
  @IsNotEmpty()
  diagramId: string;

  @ApiProperty({ required: false, example: 'ROOM-FAC123' })
  @IsOptional()
  @IsString()
  roomCode?: string;

  @ApiProperty({ required: false, type: [Object] })
  @IsOptional()
  @IsArray()
  currentNodes?: any[];

  @ApiProperty({ required: false, type: [Object] })
  @IsOptional()
  @IsArray()
  currentConnections?: any[];
}
```

### 2. `AiVisionPromptDto`
```typescript
export class AiVisionPromptDto {
  @ApiProperty({ example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiProperty({ example: 'image/png', default: 'image/png' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ required: false, example: 'Digitaliza el diagrama de la pizarra' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiProperty({ example: 'd9b736b4-2b62-4217-a068-d0a5180f9702' })
  @IsString()
  @IsNotEmpty()
  diagramId: string;

  @ApiProperty({ required: false, example: 'ROOM-FAC123' })
  @IsOptional()
  @IsString()
  roomCode?: string;
}
```

---

## 🧪 Pruebas Unitarias
Se ejecutan mediante `npm test` en backend:
* `ai-assistant.service.spec.ts`: Pruebas de mutación de diagrama, aplicación de guardrails de negocio y extracción visual por imagen.
* `ai-assistant.controller.spec.ts`: Cobertura de endpoints REST HTTP de procesamiento de texto y visión.
