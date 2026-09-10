# 📋 Catálogo y Especificación Tabular de Casos de Uso del Sistema

## 👥 Definición de Actores del Sistema

| Código | Actor | Rol / Descripción |
| :---: | :--- | :--- |
| **A1** | **Ingeniero Anfitrión (OWNER)** | Crea el proyecto, configura paquetes base (`com.empresa.app`), versiones de
plataforma (Java/Spring Boot), gestiona colaboradores y administra permisos del espacio de trabajo. |
| **A2** | **Ingeniero Colaborador (EDITOR / VIEWER)** | Modifica el diagrama UML en tiempo real (en rol `EDITOR`),
adquiere bloqueos de exclusión mutua, inspecciona modelos en modo lectura (en rol `VIEWER`), ejecuta exportaciones y
descarga artefactos. |

---

## 📊 Matriz Consolidada de Casos de Uso

| ID | CASO DE USO | ACTOR | PRIORIDAD |
| :---: | :--- | :---: | :---: |
| **CU-01** | Gestión de Autenticación y Sesión de Usuario | **A1, A2** | `ALTA` |
| **CU-02** | Gestión de Proyectos | **A1** | `ALTA` |
| **CU-03** | Gestión de Miembros y Roles | **A1** | `ALTA` |
| **CU-04** | Gestión de Clases y Estructura Interna (Atributos y Métodos) | **A1, A2** | `ALTA` |
| **CU-05** | Gestión de Relaciones y Conectores UML | **A1, A2** | `ALTA` |
| **CU-06** | Sincronización de Presencia, Cursores y Mutaciones del Diagrama | **A1, A2** | `ALTA` |
| **CU-07** | Exclusión Mutua y Bloqueo de Tablas para Edición Segura | **A1, A2** | `ALTA` |
| **CU-08** | Exportación e Importación Interoperable | **A1, A2** | `BAJA` |
| **CU-10** | Asistente IA por Comandos de Texto y Voz | **A1, A2** | `MEDIA` |
| **CU-11** | Asistente IA por Digitalización de Imagen | **A1, A2** | `MEDIA` |
| **CU-12** | Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e Imagen | **A1,
A2** | `ALTA` |
| **CU-13** | Vista Previa de Arquitectura Fullstack en Vivo | **A1, A2** | `MEDIA` |
| **CU-14** | Compilación y Descarga del Proyecto Fullstack en ZIP | **A1, A2** | `ALTA` |

---

## 📑 Especificación Detallada de Casos de Uso (Formato Tabular)

### 🔹 CU-01. Gestión de Autenticación y Sesión de Usuario

| Campo | Detalle |
| :--- | :--- |
| **Nombre de CU** | CU-01. Gestión de Autenticación y Sesión de Usuario |
| **Propósito** | Permitir el registro de nuevos usuarios, la autenticación mediante credenciales seguras, la emisión y
validación de tokens JWT y la consulta de la sesión activa del ingeniero. |
| **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
| **Actor iniciador** | A1 o A2 |
| **Precondición** | Conexión con el servidor backend y base de datos PostgreSQL activa. Para consulta de perfil, token
JWT válido en cabecera HTTP. |
| **Flujo principal** | **Registrar Usuario:**<br>• Ingresar datos de registro (`fullName`, `email`, `password` $\ge$ 6
caracteres).<br>• El sistema valida el formato, genera el hash `bcrypt` (10 salt rounds) y almacena el registro en la
tabla `users`.<br>• Se emite un token JWT firmado (duración 7 días) y se retorna junto con los datos del
usuario.<br><br>**Iniciar Sesión:**<br>• Ingresar credenciales (`email`, `password`).<br>• El sistema verifica la
existencia del usuario y valida la contraseña mediante `bcrypt.compare`.<br>• Se emite el token JWT, se actualiza el
Signal reactivo `currentUser` y se redirige al dashboard de proyectos.<br><br>**Consultar Perfil y Verificar
Sesión:**<br>• El cliente efectúa una petición `GET /api/auth/me` con cabecera `Authorization: Bearer <token>`.<br>•
    `JwtAuthGuard` valida la firma del token y `@CurrentUser()` inyecta el perfil activo.<br>• Se renderiza el nombre y
    avatar del usuario en la barra superior. |
    | **Postcondición** | Usuario autenticado en el sistema con token JWT activo en almacenamiento local y acceso a sus
    proyectos. |
    | **Excepción** | • **Correo Duplicado:** Retorna HTTP `409 Conflict` con mensaje "El correo electrónico ya está
    registrado".<br>• **Credenciales Incorrectas:** Retorna HTTP `401 Unauthorized` con mensaje "Credenciales
    inválidas".<br>• **Token Expirado/Inválido:** Retorna HTTP `401 Unauthorized`; el interceptor frontend redirige
    automáticamente al Login. |

    ---

    ### 🔹 CU-02. Gestión de Proyectos

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-02. Gestión de Proyectos |
    | **Propósito** | Permitir al ingeniero anfitrión crear proyectos de modelado UML, definir paquetes base y versiones
    tecnológicas (Java/Spring Boot), actualizar metadatos y eliminar proyectos en cascada. |
    | **Actores** | A1 (Ingeniero Anfitrión / OWNER), A2 (Ingeniero Colaborador / EDITOR) |
    | **Actor iniciador** | A1 (OWNER) |
    | **Precondición** | Usuario autenticado con sesión JWT activa. Para modificación o eliminación, permisos
    correspondientes según rol. |
    | **Flujo principal** | **Crear Proyecto:**<br>• Clic en `+ Nuevo Proyecto`.<br>• Ingresar datos técnicos: `name`,
    `description`, `basePackage` (ej: `com.empresa.app`), `javaVersion` (17 o 21) y `springBootVersion`.<br>• El sistema
    persiste el proyecto, asigna al creador como `OWNER` en `project_members` y genera automáticamente el diagrama de
    clases raíz ("Diagrama Principal").<br><br>**Modificar Proyecto:**<br>• Abrir modal de configuración de
    proyecto.<br>• Modificar nombre, descripción, paquete base o versiones de compilación y guardar cambios.<br>• El
    sistema actualiza los registros en la base de datos.<br><br>**Eliminar Proyecto:**<br>• El anfitrión (`OWNER`)
    confirma la eliminación del proyecto.<br>• El backend ejecuta borrado en cascada eliminando miembros, diagramas,
    nodos, conexiones, sesiones y versiones.<br><br>**Listar Proyectos:**<br>• El usuario visualiza la lista de
    proyectos propios y compartidos con indicador de rol (`OWNER`, `EDITOR`, `VIEWER`). |
    | **Postcondición** | Proyecto creado/actualizado o eliminado en PostgreSQL con su diagrama raíz disponible. |
    | **Excepción** | • **Nombre Vacío o Inválido:** HTTP `400 Bad Request`.<br>• **Eliminación por No Propietario:**
    HTTP `403 Forbidden` ("Solo el propietario puede eliminar el proyecto"). |

    ---

    ### 🔹 CU-03. Gestión de Miembros y Roles

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-03. Gestión de Miembros y Roles |
    | **Propósito** | Administrar el equipo de trabajo del proyecto mediante invitación por correo institucional,
    asignación de roles RBAC (`EDITOR` / `VIEWER`) y revocación de accesos. |
    | **Actores** | A1 (Ingeniero Anfitrión / OWNER) |
    | **Actor iniciador** | A1 (OWNER) |
    | **Precondición** | El usuario iniciador debe tener el rol `OWNER` del proyecto; los usuarios a invitar deben estar
    registrados en la plataforma. |
    | **Flujo principal** | **Invitar Miembro:**<br>• Abrir el panel de miembros del proyecto.<br>• Ingresar correo
    electrónico del colaborador (ej. `jose@uagrm.edu.bo`) y seleccionar rol inicial (`EDITOR` o `VIEWER`).<br>• El
    sistema valida la existencia del usuario, comprueba que no sea miembro y crea el registro en
    `project_members`.<br><br>**Modificar Rol de Colaborador:**<br>• Seleccionar miembro en la tabla de miembros.<br>•
    Cambiar rol (`EDITOR` $\leftrightarrow$ `VIEWER`) y confirmar.<br>• Si el usuario está conectado en vivo al
    diagrama, sus privilegios de edición se ajustan en caliente.<br><br>**Expulsar Miembro:**<br>• Clic en botón
    "Eliminar miembro" y confirmar acción.<br>• El sistema revoca el acceso del usuario y cierra sus sesiones de
    colaboración asociadas. |
    | **Postcondición** | Colaborador vinculado, actualizado o revocado en el proyecto. |
    | **Excepción** | • **Usuario No Encontrado:** HTTP `404 Not Found` ("El usuario no existe").<br>• **Miembro Ya
    Registrado:** HTTP `409 Conflict` ("El usuario ya es miembro de este proyecto").<br>• **Acción no autorizada:** HTTP
    `403 Forbidden` si un no-propietario intenta gestionar miembros. |

    ---

    ### 🔹 CU-04. Gestión de Clases y Estructura Interna (Atributos y Métodos)

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-04. Gestión de Clases y Estructura Interna (Atributos y Métodos) |
    | **Propósito** | Crear, posicionar, redimensionar y eliminar cajas de clases UML en el lienzo, y definir su
    estructura interna de atributos tipados fuertemente y métodos con visibilidad y parámetros. |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador con rol EDITOR) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Diagrama abierto con rol de edición (`OWNER` o `EDITOR`). La clase a modificar no debe estar
    bloqueada por otro usuario. |
    | **Flujo principal** | **Crear y Posicionar Clase:**<br>• Clic en `+ Nueva Clase UML` en la barra de
    herramientas.<br>• El sistema inserta un nuevo nodo con ID único y coordenadas $(X, Y)$ evitando solapamientos.<br>•
    El usuario puede arrastrar libremente la clase por el lienzo; las coordenadas se transmiten en vivo a los
    colaboradores.<br><br>**Redimensionar Clase:**<br>• Arrastrar la manija inferior derecha `◢` de la clase para
    ajustar ancho y alto según el contenido.<br><br>**Editar Atributos y Métodos:**<br>• Doble clic sobre la clase
    (adquiere bloqueo exclusivo `lock_node`).<br>• En el modal, modificar nombre de la clase (PascalCase).<br>•
    **Atributos (-):** Agregar nombre y tipo estricto (`UUID`, `String`, `Integer`, `Long`, `Boolean`, `Double`,
    `LocalDate`, `Text`, etc.).<br>• **Métodos (+):** Agregar nombre, parámetros tipados y selector de tipo de
    retorno.<br>• Guardar cambios: se actualiza el canvas, se libera el bloqueo (`unlock_node`) y se sincroniza con el
    backend.<br><br>**Eliminar Clase:**<br>• Clic en botón (&times;) de cabecera; se elimina la clase y en cascada todas
    sus relaciones asociadas. |
    | **Postcondición** | Estructura de la clase actualizada en el AST del diagrama y sincronizada en tiempo real. |
    | **Excepción** | • **Nodo Bloqueado:** Notificación de que otro usuario está editando la tabla.<br>• **Modo Solo
    Lectura:** Acciones de modificación deshabilitadas para usuarios `VIEWER`. |

    ---

    ### 🔹 CU-05. Gestión de Relaciones y Conectores UML

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-05. Gestión de Relaciones y Conectores UML |
    | **Propósito** | Establecer y configurar relaciones semánticas UML 2.5 entre clases (Asociación, Generalización,
    Realización, Composición, Agregación, Dependencia) y trazar Clases de Asociación N:M con cálculo de punto medio. |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador con rol EDITOR) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Al menos dos clases creadas en el lienzo; permisos de edición activos. |
    | **Flujo principal** | **Crear Relación Estándar:**<br>• Seleccionar herramienta en el Toolbox (Asociación,
    Generalización, Realización, Composición, Agregación, Dependencia).<br>• Clic en la clase de origen y clic en la
    clase de destino.<br>• El sistema calcula los puertos de anclaje óptimos (`_top`, `_right`, `_bottom`, `_left`) y
    traza la conexión con sus marcadores gráficos oficiales.<br><br>**Configurar Multiplicidades y Enrutamiento:**<br>•
    Doble clic sobre la línea de conexión.<br>• Configurar multiplicidades de origen y destino (`1`, `0..1`, `1..*`,
    `0..*`, `*`) y rol textual.<br>• Seleccionar estilo de línea (*Ortogonal*, *Directa*, *Bezier*,
    *Adaptativa*).<br><br>**Crear Clase de Asociación N:M:**<br>• Seleccionar `Association Class` y conectar dos clases
    base (ej. `Estudiante` y `Materia`).<br>• El sistema inserta un nodo ancla invisible en el punto medio geométrico
    $(\frac{x_1+x_2}{2}, \frac{y_1+y_2}{2})$ y genera la clase intermedia conectada con línea
    discontinua.<br><br>**Eliminar Conector:**<br>• Seleccionar la conexión y presionar tecla `Supr` / `Delete` o botón
    de eliminar. |
    | **Postcondición** | Conexión semántica registrada en el AST y renderizada en todos los clientes. |
    | **Excepción** | • **Auto-conexión Inválida:** Conexiones no permitidas según reglas UML se cancelan con feedback
    visual. |

    ---

    ### 🔹 CU-06. Sincronización de Presencia, Cursores y Mutaciones del Diagrama

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-06. Sincronización de Presencia, Cursores y Mutaciones del Diagrama |
    | **Propósito** | Fundir la presencia visual en tiempo real (avatares y punteros de ratón a ~40 FPS) con la
    co-edición reactiva bidireccional y la experiencia en vivo para observadores (`VIEWER`). |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador / VIEWER) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Conexión WebSocket establecida con el Gateway `/collaboration`. |
    | **Flujo principal** | **Unirse a la Sala de Colaboración:**<br>• Al entrar al editor, el cliente emite `join_room`
    con `{ diagramId, userId, userName, color }`.<br>• El servidor difunde `room_participants_updated`; se renderizan
    los avatares activos en la barra superior.<br><br>**Transmitir y Renderizar Cursores:**<br>• Al mover el ratón sobre
    el canvas, el cliente emite `cursor_move` con throttle.<br>• Los demás participantes visualizan el puntero flotante
    con el nombre y color de cada colaborador.<br><br>**Co-edición Reactiva de Mutaciones:**<br>• Cuando un usuario
    arrastra una clase (`node_drag`) o modifica el diagrama, se difunde `diagram_synced`.<br>• Todos los navegadores
    actualizan su lienzo instantáneamente sin recargar la página.<br><br>**Modo Espectador (VIEWER):**<br>• Usuarios con
    rol `VIEWER` observan todas las mutaciones en vivo pero mantienen deshabilitadas las herramientas de creación,
    edición y guardado. |
    | **Postcondición** | Estado visual sincronizado fielmente entre todos los participantes conectados. |
    | **Excepción** | • **Desconexión Inesperada:** El servidor emite `user_left` al detectar caída del socket y limpia
    el cursor y avatar correspondiente. |

    ---

    ### 🔹 CU-07. Exclusión Mutua y Bloqueo de Tablas para Edición Segura

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-07. Exclusión Mutua y Bloqueo de Tablas para Edición Segura |
    | **Propósito** | Adquirir bloqueos a nivel de nodo (*Node-Level Locking*) cuando un usuario entra a editar una
    clase, impidiendo colisiones y sobreescrituras destructivas concurrentes. |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Diagrama compartido entre múltiples usuarios en vivo; clase objetivo sin bloqueo activo. |
    | **Flujo principal** | **Adquirir Bloqueo Exclusivo:**<br>• Usuario A hace doble clic en la clase `Usuario`.<br>•
    El cliente emite `lock_node`; el servidor lo registra en memoria y difunde `node_locked`.<br>• En los navegadores de
    los demás usuarios, la clase muestra el badge `🔒 [Usuario A] (editando...)`, resalta su borde y activa cursor
    `not-allowed`.<br><br>**Rechazo Concurrente:**<br>• Si Usuario B intenta editar la misma clase bloqueada, el sistema
    deniega la acción con una notificación de advertencia.<br><br>**Liberar Bloqueo y Sincronizar:**<br>• Usuario A
    guarda cambios o cancela la edición.<br>• El cliente emite `unlock_node` y `diagram_sync`; el servidor difunde
    `node_unlocked` y la estructura actualizada a toda la sala.<br><br>**Tolerancia a Fallos:**<br>• Si Usuario A sufre
    caída de red o cierra el navegador con el modal abierto, el servidor libera automáticamente el bloqueo mediante
    `handleDisconnect`. |
    | **Postcondición** | Mutaciones aplicadas sin conflictos de concurrencia y recurso liberado para el equipo. |
    | **Excepción** | • **Conflicto de Bloqueo Simultáneo:** El primer mensaje procesado en el Gateway adquiere el
    bloqueo; las solicitudes posteriores reciben `node_lock_rejected`. |

    ---

    ### 🔹 CU-08. Exportación e Importación Interoperable

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-08. Exportación e Importación Interoperable |
    | **Propósito** | Permitir la persistencia transaccional del Árbol de Sintaxis Abstracta (AST) en PostgreSQL
    (`Ctrl+S`), la descarga del archivo de definición en formato JSON y la carga de diagramas desde archivos JSON
    externos. |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Diagrama abierto en el editor con elementos UML en el lienzo. |
    | **Flujo principal** | **Guardar AST en Base de Datos:**<br>• El usuario presiona `Ctrl+S` o clic en botón
    "Guardar".<br>• El frontend envía `PUT /api/diagrams/:id/ast` con todos los nodos, atributos, métodos y
    conexiones.<br>• El backend valida y almacena el estado completo en PostgreSQL respondiendo HTTP `200
    OK`.<br><br>**Exportar AST JSON:**<br>• Desplegar menú `Exportar ▾` $\rightarrow$ `Descargar AST (.json)`.<br>• El
    sistema genera y descarga automáticamente el archivo `${diagram_name}.json`.<br><br>**Visualizar JSON en
    Pantalla:**<br>• Clic en `Ver JSON AST` para inspeccionar el modelo en un modal con resaltado de
    sintaxis.<br><br>**Importar Archivo JSON:**<br>• Clic en `Importar ▾ -> Cargar Archivo .json`.<br>• Seleccionar
    archivo local; el sistema valida el esquema, limpia el lienzo y renderiza el nuevo modelo. |
    | **Postcondición** | Modelo AST persistido en base de datos o exportado/importado exitosamente en JSON. |
    | **Excepción** | • **Archivo JSON Corrupto:** Muestra alerta de error de validación de estructura sin alterar el
    lienzo actual. |

    ---

    ### 🔹 CU-10. Asistente IA por Comandos de Texto y Voz

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-10. Asistente IA por Comandos de Texto y Voz |
    | **Propósito** | Interpretar comandos en lenguaje natural ingresados por teclado o dictados por voz mediante Web
    Speech API, procesando las solicitudes con el motor Gemini 2.5 Flash para mutar el diagrama UML y difundir los
    cambios en vivo a los colaboradores. |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Diagrama abierto con permisos de edición y backend conectado a Google Cloud Vertex AI / Gemini.
    |
    | **Flujo principal** | **Ejecutar Comando de Texto:**<br>• El usuario escribe en el panel IA: *"Crea una tabla
    Producto con id UUID, nombre String, precio Double y conéctala con Categoria con relación muchos a uno"*.<br>• El
    frontend envía `POST /api/ai/prompt` con el texto y el contexto AST actual.<br>• Gemini 2.5 Flash genera la
    estructura JSON con tipos sanitizados y coordenadas sin solapamiento.<br>• El backend difunde `diagram_synced` y
    responde HTTP `200 OK`; el canvas se actualiza en vivo.<br><br>**Ejecutar Dictado por Voz:**<br>• Clic en botón de
    micrófono `🎙️`.<br>• La Web Speech API captura la voz en tiempo real y transcribe el audio al área de texto.<br>•
    El usuario envía el comando y Gemini aplica la transformación sobre el diagrama.<br><br>**Guardrail de
    Ambigüedad:**<br>• Si el comando es una historia vaga sin entidades concretas, la IA orienta al usuario sin mutar el
    canvas. |
    | **Postcondición** | Clases y relaciones generadas por IA renderizadas en pantalla y registradas en el historial de
    mutaciones. |
    | **Excepción** | • **Error de Reconocimiento de Voz / Micrófono:** Alerta de permisos en navegador.<br>• **Falla de
    API Vertex AI:** Notificación de error y reintento sin corrupción de datos. |

    ---

    ### 🔹 CU-11. Asistente IA por Digitalización de Imagen

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-11. Asistente IA por Digitalización de Imagen |
    | **Propósito** | Digitalizar automáticamente bocetos a mano alzada, fotos de pizarras o capturas de pantalla de
    diagramas UML mediante visión computacional multimodal (Gemini Vision) para convertirlos en clases y relaciones
    interactivas. |
    | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
    | **Actor iniciador** | A1 o A2 |
    | **Precondición** | Archivo de imagen válido (`.png`, `.jpg`, `.webp`) y conexión activa con Gemini Vision. |
    | **Flujo principal** | **Cargar Imagen de Diagrama:**<br>• Clic en botón `🖼️` del panel Copilot IA y seleccionar
    fotografía o boceto.<br>• El panel presenta la miniatura de la imagen cargada.<br><br>**Procesar Visión
    Computacional:**<br>• Clic en "Digitalizar Diagrama con IA".<br>• El frontend envía `POST /api/ai/vision-diagram`
    con la imagen en Base64.<br>• Gemini 2.5 Flash analiza visualmente las formas geométricas, textos, compartimentos y
    flechas.<br>• El backend extrae los nodos con atributos/métodos tipados y conexiones con
    multiplicidades.<br><br>**Renderizado y Difusión en Vivo:**<br>• El backend devuelve los elementos estructurados y
    difunde `diagram_synced` a todos los clientes.<br>• El lienzo de Foblex Flow dibuja fielmente el diagrama
    digitalizado listo para edición continua. |
    | **Postcondición** | Imagen digitalizada convertida en entidades interactivas Foblex Flow en el canvas. |
    | **Excepción** | • **Imagen Ilegible / Sin Diagrama:** Notificación indicando que no se detectaron clases UML
    legibles.<br>• **Archivo Demasiado Pesado:** Validación de tamaño máximo de carga en cliente. |

    ---

    ### 🔹 CU-12. Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e Imagen

    | Campo | Detalle |
    | :--- | :--- |
    | **Nombre de CU** | CU-12. Exportación e Importacion XMI 2.1 con Geometría de Diagrama (Enterprise Architect v17) e
    Imagen |
    | **Propósito** | Proporcionar interoperabilidad completa mediante exportación e importación estándar XML XMI 2.1
    con geometría `<diagrams>
        <elements>` para Enterprise Architect v17, exportación a imagen Bitmap BMP 24-bit de alta fidelidad y control de
            versiones inmutables. |
            | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
            | **Actor iniciador** | A1 o A2 |
            | **Precondición** | Diagrama con clases modeladas en el lienzo. Para restauración de versiones, privilegios
            de edición. |
            | **Flujo principal** | **Exportar a Enterprise Architect (.xmi 2.1):**<br>• Menú `Exportar ▾` $\rightarrow$
            `Enterprise Architect (.xmi)`.<br>• El sistema genera el documento XML XMI 2.1 incluyendo modelo semántico y
            coordenadas exactas de dibujo.<br>• Se descarga `${diagram_name}_ea.xmi`. Al abrirlo en EA v17, el diagrama
            aparece dibujado automáticamente.<br><br>**Exportar Imagen Bitmap (.bmp - EA):**<br>• Menú `Exportar ▾`
            $\rightarrow$ `Imagen Bitmap (.bmp - EA)`.<br>• `BmpExportService` captura el DOM a resolución $2\times$,
            sanitiza elementos SVG y codifica la matriz de píxeles binaria BMP de 24 bits.<br>• Descarga
            `${diagram_name}.bmp` idéntico visualmente al canvas sin puntos negros ni manchas.<br><br>**Importar Archivo
            XML/XMI de Enterprise Architect:**<br>• Menú `Importar ▾` $\rightarrow$ `Cargar Archivo .xml / .xmi`.<br>•
            El parser extrae clases, compartimentos, multiplicidades y coordenadas `Left/Top` y reconstruye el diagrama
            en el lienzo.<br><br>**Gestionar Snapshots y Versiones:**<br>• Crear snapshots congelados con etiqueta
            semántica (ej. `v1.0.0`) y restaurar estados previos en cualquier momento. |
            | **Postcondición** | Archivo `.xmi` / `.bmp` descargado, modelo externo importado o snapshot registrado en
            historial. |
            | **Excepción** | • **XML Mal Formado:** Retorna HTTP `400 Bad Request` indicando error de parseo sin
            corromper el modelo activo. |

            ---

            ### 🔹 CU-13. Vista Previa de Arquitectura Fullstack en Vivo

            | Campo | Detalle |
            | :--- | :--- |
            | **Nombre de CU** | CU-13. Vista Previa de Arquitectura Fullstack en Vivo |
            | **Propósito** | Permitir a los ingenieros inspeccionar interactivamente todo el código fuente generado por
            capas tanto para Spring Boot 4 como para Flutter antes de su descarga. |
            | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador / VIEWER) |
            | **Actor iniciador** | A1 o A2 |
            | **Precondición** | Diagrama UML con al menos una clase definida con atributos y tipos. |
            | **Flujo principal** | **Abrir Modal de Generación Fullstack:**<br>• Clic en el botón `⚡ Generador
            Fullstack (Spring Boot + Flutter)` en la barra superior.<br><br>**Compilar Diagrama a Código:**<br>• El frontend
            solicita `POST /api/codegen/preview/:diagramId`.<br>• El backend consulta el diagrama persistente en PostgreSQL y los motores `SpringTemplateEngineService` y
            `FlutterTemplateEngineService` generan en memoria las estructuras completas.<br><br>**Explorar Árbol de
            Archivos:**<br>• El usuario navega por las carpetas y archivos en el árbol lateral clasificado por capas
            (*Entities*, *Repositories*, *DTOs*, *Services*, *Controllers*, *Flyway SQL*, *Docker*, *BLoC*, *Pages*,
            *Widgets*).<br><br>**Inspeccionar Código con Resaltado de Sintaxis:**<br>• Al hacer clic sobre cualquier
            archivo, el visor central renderiza el código fuente exacto con números de línea y tipografía
            monospace.<br><br>**Filtrar por Plataforma:**<br>• Alternar entre vistas *Solución Completa*, *Spring Boot
            Backend* o *Flutter Mobile*. |
            | **Postcondición** | Código fuente inspeccionado y validado en pantalla sin descargar archivos locales. |
            | **Excepción** | • **Diagrama Vacío o No Guardado:** Alerta indicando que se requiere guardar el diagrama previamente y tener al menos una clase. |

            ---

            ### 🔹 CU-14. Compilación y Descarga del Proyecto Fullstack en ZIP

            | Campo | Detalle |
            | :--- | :--- |
            | **Nombre de CU** | CU-14. Compilación y Descarga del Proyecto Fullstack en ZIP |
            | **Propósito** | Compilar, generar y empaquetar en memoria la solución completa de backend Spring Boot 4 y
            frontend móvil Flutter Clean Architecture a partir del diagrama persistido en un archivo comprimido `.zip` listo para producción, Docker y
            depuración USB. |
            | **Actores** | A1 (Ingeniero Anfitrión), A2 (Ingeniero Colaborador) |
            | **Actor iniciador** | A1 o A2 |
            | **Precondición** | Diagrama de clases guardado y persistido en la base de datos con al menos una clase. |
            | **Flujo principal** | **Solicitar Descarga Fullstack:**<br>• Clic en `📦 Descargar Solución Fullstack
            (.zip)` en el modal del generador.<br>• El frontend envía `POST /api/codegen/download/:diagramId`.<br><br>**Empaquetado en Memoria:**<br>• `ZipArchiverService` comprime en
            memoria:<br> 1. `backend/`: Código fuente Spring Boot 4 + JPA, migraciones Flyway SQL, Swagger OpenAPI,
            Dockerfile y `docker-compose.yml`.<br> 2. `mobile_flutter/`: Clean Architecture (Data, Domain,
            Presentation), GetIt Service Locator, Dio HTTP client, BLoC State Management y runners nativos Android /
            Linux.<br><br>**Descarga de Artefacto:**<br>• El navegador descarga automáticamente
            `${project_name}-fullstack.zip`.<br><br>**Despliegue y Conexión USB:**<br>• Descomprimir el ZIP y levantar
            backend con `docker compose up --build`.<br>• Conectar celular Android por USB y ejecutar `adb reverse
            tcp:8080 tcp:8080`.<br>• Iniciar app móvil con `flutter run`; Flutter consume la API local en
            `http://localhost:8080/api/v1` vía túnel USB. |
            | **Postcondición** | Archivo `.zip` descargado y ejecutable en local y móvil sin dependencias faltantes. |
            | **Excepción** | • **Falla de Empaquetado:** Notificación de error en servidor sin interrumpir la sesión
            del usuario. |
