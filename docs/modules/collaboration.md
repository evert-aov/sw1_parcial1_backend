# 📡 Módulo de Colaboración en Tiempo Real (WebSockets & Sincronización)

## 📌 Descripción General
El módulo de colaboración gestiona las sesiones concurrentes de modelado UML en tiempo real sobre el mismo diagrama, ofreciendo:
1. **Presencia y cursores en vivo:** Transmisión de coordenadas del cursor `(x, y)` con nombres y colores diferenciados para cada colaborador.
2. **Sincronización reactiva del lienzo:** Propagación inmediata de mutaciones sobre nodos, atributos, métodos y conexiones entre los clientes conectados a la sala.
3. **Persistencia de sesiones activas:** Registro en PostgreSQL de sesiones activas (`collaboration_sessions`) y participantes (`session_participants`).

---

## 🏛 Arquitectura en 5 Capas

```
modules/collaboration/
├── entities/
│   ├── collaboration-session.entity.ts # Sesión de sala activa vinculada a un diagrama
│   └── session-participant.entity.ts    # Participante con color de cursor y estado de conexión
├── dtos/
│   ├── join-room.dto.ts                 # DTO para unirse o iniciar sala
│   ├── cursor-position.dto.ts           # DTO para coordenadas del cursor
│   └── session-response.dto.ts          # Respuesta estructurada con participantes
├── repositories/
│   └── session.repository.ts            # Operaciones de persistencia TypeORM
├── services/
│   └── yjs-sync.service.ts              # Lógica de asignación de salas, colores y estados
├── gateways/
│   └── collaboration.gateway.ts         # Gateway WebSocket Socket.io (/collaboration)
└── controllers/
    └── collaboration.controller.ts      # Endpoints REST para consulta y gestión de sesiones
```

---

## 🔌 Endpoints REST

### 1. `POST /api/collaboration/sessions/join`
* **Descripción:** Inicia una nueva sesión activa o se une a una existente para un diagrama.
* **Seguridad:** Requiere Bearer JWT Token (`JwtAuthGuard`).
* **Request Body (`JoinRoomDto`):**
  ```json
  {
    "diagramId": "4f9d0c2e-7b56-42d3-9f5b-1c5c0a3f81e2",
    "roomCode": "ROOM-FAC123",
    "cursorColor": "#10B981"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "8a3e7b1a-9f12-4c2d-98e3-5a7c2d1b0e4f",
      "diagramId": "4f9d0c2e-7b56-42d3-9f5b-1c5c0a3f81e2",
      "roomCode": "ROOM-FAC123",
      "isActive": true,
      "startedAt": "2026-08-28T23:15:00.000Z",
      "participants": [
        {
          "id": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
          "userId": "d7a8e2b1-3f4c-4e5a-8b9c-0d1e2f3a4b5c",
          "fullName": "Evert Ingeniero",
          "email": "evert@uagrm.edu.bo",
          "cursorColor": "#10B981",
          "isConnected": true,
          "lastSeenAt": "2026-08-28T23:15:00.000Z"
        }
      ]
    }
  }
  ```

### 2. `GET /api/collaboration/sessions/diagram/:diagramId`
* **Descripción:** Obtiene los detalles y participantes de la sesión activa de un diagrama.
* **Response (200 OK):** `SessionResponseDto` o `null` si no hay sesión activa.

### 3. `GET /api/collaboration/sessions/:id`
* **Descripción:** Obtiene los detalles de una sesión por su identificador UUID.

### 4. `DELETE /api/collaboration/sessions/:id`
* **Descripción:** Finaliza y desactiva la sesión de colaboración.

---

## ⚡ Eventos WebSocket (`Namespace: /collaboration`)

| Evento de Entrada | Payload | Evento de Salida Emitido | Descripción |
|---|---|---|---|
| `join_room` | `{ diagramId, roomCode, userId, userName, color }` | `user_joined` | Une el socket a la sala y notifica a los demás participantes. |
| `leave_room` | `{ roomCode, userId, sessionId }` | `user_left` | Retira el socket de la sala y actualiza presencia. |
| `cursor_move` | `{ roomCode, userId, userName, x, y, color }` | `cursor_moved` | Transmite en vivo la posición del cursor de un usuario al resto de la sala. |
| `node_drag` | `{ roomCode, nodeId, position, userId }` | `node_dragged` | Sincroniza el movimiento en caliente de las tablas UML. |
| `diagram_sync` | `{ roomCode, nodes, connections, userId, action }` | `diagram_synced` | Sincroniza cambios estructurales en el AST del diagrama. |
| `chat_message` | `{ roomCode, userId, userName, message }` | `chat_message_received` | Chat colaborativo instantáneo entre los participantes. |

---

## 🧪 Pruebas Unitarias
Se ejecutan mediante `npm test`:
* `yjs-sync.service.spec.ts`: Cobertura de inicio de sala, unión de usuarios, abandono, consulta y cierre.
* `collaboration.controller.spec.ts`: Cobertura de endpoints REST HTTP.
