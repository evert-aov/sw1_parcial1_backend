import { ProjectContext, toSnakeCase } from '../spring_boot/template-models';
import { getPluralName } from './flutter-models';

export function renderFlutterReadme(context: ProjectContext): string {
  const port = context.serverPort || 8080;

  const lines = [
    `# 📱 ${context.projectName} (Flutter Mobile App)`,
    '',
    'Aplicación móvil desarrollada en **Flutter** con arquitectura limpia (**Clean Architecture**), patrón de gestión de estado **BLoC** (`flutter_bloc`), cliente HTTP **Dio**, e inyección de dependencias con **GetIt**.',
    '',
    '---',
    '',
    '## 🏗 Estructura del Proyecto (Clean Architecture)',
    '',
    '```text',
    'lib/',
    '├── core/                         # Núcleo reutilizable',
    '│   ├── constants/api_constants.dart',
    '│   ├── errors/exceptions.dart & failures.dart',
    '│   ├── network/api_client.dart   # Cliente Dio con interceptores',
    '│   └── theme/app_theme.dart      # Tema Material 3',
    '│',
    '├── features/                     # Módulos por entidad del diagrama UML',
    ...context.classes.map((c) => {
      const s = toSnakeCase(c.className);
      const sp = getPluralName(s);
      return `│   ├── ${s}/\n│   │   ├── data/ (datasources, models, repositories)\n│   │   ├── domain/ (entities, repositories, usecases)\n│   │   └── presentation/ (bloc, pages, widgets)`;
    }),
    '│',
    '├── injection_container.dart      # Configuración de dependencias (GetIt)',
    '└── main.dart                     # Punto de entrada y MultiBlocProvider',
    '```',
    '',
    '---',
    '',
    `## 🔌 Conexión con el Backend Spring Boot (Puerto ${port})`,
    '',
    '### 📲 Opción 1: Dispositivo Físico Android por Cable USB (Recomendado)',
    'Conecta tu teléfono Android a la PC por cable USB con la **Depuración USB** activada y ejecuta en tu terminal:',
    '',
    '```bash',
    `adb reverse tcp:${port} tcp:${port}`,
    '```',
    '',
    `Esto reenviará las peticiones de \`http://localhost:${port}\` en tu teléfono directamente a tu PC.`,
    '',
    '### 💻 Opción 2: Emulador de Android Studio',
    `El emulador de Android mapea el localhost de tu PC a la IP especial: \`http://10.0.2.2:${port}/api/v1\`.`,
    '',
    '---',
    '',
    '## 🚀 Ejecución de la Aplicación',
    '',
    '1. Instalar las dependencias de Flutter:',
    '```bash',
    'flutter pub get',
    '```',
    '',
    '2. Ejecutar la aplicación en tu dispositivo o emulador:',
    '```bash',
    'flutter run',
    '```',
    '',
    '---',
    '',
    '## ✨ Módulos y Pantallas CRUD Generadas',
    '',
    '| Entidad | Capas Clean Architecture | Pantalla Lista | Pantalla Formulario |',
    '| :--- | :--- | :--- | :--- |',
    ...context.classes.map((c) => {
      const s = toSnakeCase(c.className);
      const cp = getPluralName(c.className);
      return `| **${c.className}** | Data, Domain, Presentation (BLoC) | \`${c.className}ListPage\` | \`${c.className}FormPage\` |`;
    }),
  ];

  return lines.join('\n') + '\n';
}
