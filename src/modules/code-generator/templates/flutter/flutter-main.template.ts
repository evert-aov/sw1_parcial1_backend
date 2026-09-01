import { ProjectContext, toSnakeCase } from '../spring_boot/template-models';
import { getPluralName } from './flutter-models';

export function renderFlutterInjectionContainer(context: ProjectContext): string {
  const imports: string[] = [
    "import 'package:get_it/get_it.dart';",
    "import 'core/network/api_client.dart';",
    "import 'core/services/token_storage_service.dart';",
  ];

  if (context.hasAuth) {
    imports.push("import 'features/auth/data/datasources/auth_remote_datasource.dart';");
    imports.push("import 'features/auth/data/repositories/auth_repository_impl.dart';");
    imports.push("import 'features/auth/domain/repositories/auth_repository.dart';");
    imports.push("import 'features/auth/domain/usecases/auth_usecases.dart';");
    imports.push("import 'features/auth/presentation/bloc/auth_bloc.dart';");
  }

  for (const meta of context.classes) {
    const snake = toSnakeCase(meta.className);
    const snakePlural = getPluralName(snake);
    imports.push(`import 'features/${snake}/data/datasources/${snake}_remote_datasource.dart';`);
    imports.push(`import 'features/${snake}/data/repositories/${snake}_repository_impl.dart';`);
    imports.push(`import 'features/${snake}/domain/repositories/${snake}_repository.dart';`);
    imports.push(`import 'features/${snake}/domain/usecases/get_${snakePlural}_usecase.dart';`);
    imports.push(`import 'features/${snake}/domain/usecases/get_${snake}_by_id_usecase.dart';`);
    imports.push(`import 'features/${snake}/domain/usecases/create_${snake}_usecase.dart';`);
    imports.push(`import 'features/${snake}/domain/usecases/update_${snake}_usecase.dart';`);
    imports.push(`import 'features/${snake}/domain/usecases/delete_${snake}_usecase.dart';`);
    imports.push(`import 'features/${snake}/presentation/bloc/${snake}_bloc.dart';`);
  }

  const registrations: string[] = [];

  // Core
  registrations.push('  // Core Network & Storage');
  registrations.push('  await TokenStorageService.init();');
  registrations.push('  sl.registerLazySingleton<ApiClient>(() => ApiClient());\n');

  if (context.hasAuth) {
    registrations.push('  // ================= Feature: Authentication (JWT) =================');
    registrations.push('  sl.registerFactory(() => AuthBloc(');
    registrations.push('    loginUseCase: sl(),');
    registrations.push('    registerUseCase: sl(),');
    registrations.push('    logoutUseCase: sl(),');
    registrations.push('    checkAuthUseCase: sl(),');
    registrations.push('  ));');
    registrations.push('  sl.registerLazySingleton(() => LoginUseCase(repository: sl()));');
    registrations.push('  sl.registerLazySingleton(() => RegisterUseCase(repository: sl()));');
    registrations.push('  sl.registerLazySingleton(() => LogoutUseCase(repository: sl()));');
    registrations.push('  sl.registerLazySingleton(() => CheckAuthUseCase(repository: sl()));');
    registrations.push('  sl.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl(remoteDataSource: sl()));');
    registrations.push('  sl.registerLazySingleton<AuthRemoteDataSource>(() => AuthRemoteDataSourceImpl(apiClient: sl()));\n');
  }

  for (const meta of context.classes) {
    const snake = toSnakeCase(meta.className);
    const classPlural = getPluralName(meta.className);

    registrations.push(`  // ================= Feature: ${meta.className} =================`);
    // BLoC
    registrations.push(`  sl.registerFactory(() => ${meta.className}Bloc(`);
    registrations.push(`    get${classPlural}UseCase: sl(),`);
    registrations.push(`    get${meta.className}ByIdUseCase: sl(),`);
    registrations.push(`    create${meta.className}UseCase: sl(),`);
    registrations.push(`    update${meta.className}UseCase: sl(),`);
    registrations.push(`    delete${meta.className}UseCase: sl(),`);
    registrations.push(`  ));`);

    // UseCases
    registrations.push(`  sl.registerLazySingleton(() => Get${classPlural}UseCase(repository: sl()));`);
    registrations.push(`  sl.registerLazySingleton(() => Get${meta.className}ByIdUseCase(repository: sl()));`);
    registrations.push(`  sl.registerLazySingleton(() => Create${meta.className}UseCase(repository: sl()));`);
    registrations.push(`  sl.registerLazySingleton(() => Update${meta.className}UseCase(repository: sl()));`);
    registrations.push(`  sl.registerLazySingleton(() => Delete${meta.className}UseCase(repository: sl()));`);

    // Repository
    registrations.push(`  sl.registerLazySingleton<${meta.className}Repository>(() => ${meta.className}RepositoryImpl(remoteDataSource: sl()));`);

    // DataSource
    registrations.push(`  sl.registerLazySingleton<${meta.className}RemoteDataSource>(() => ${meta.className}RemoteDataSourceImpl(apiClient: sl()));\n`);
  }

  return `${imports.join('\n')}

final sl = GetIt.instance;

Future<void> init() async {
${registrations.join('\n')}
}
`;
}

export function renderFlutterHomePage(context: ProjectContext): string {
  const imports = context.classes
    .map((c) => `import '../../../${toSnakeCase(c.className)}/presentation/pages/${toSnakeCase(c.className)}_list_page.dart';`)
    .join('\n');

  const menuItems = context.classes
    .map((c) => {
      const classPlural = getPluralName(c.className);
      return `              _FeatureMenuCard(
                title: '${classPlural}',
                subtitle: 'Gestión CRUD de ${c.className}',
                icon: Icons.table_chart_outlined,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ${c.className}ListPage()),
                ),
              ),`;
    })
    .join('\n');

  return `import 'package:flutter/material.dart';
import '../../../../core/constants/api_constants.dart';
${context.hasAuth ? "import '../../../auth/presentation/pages/profile_page.dart';" : ''}
${imports}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${context.projectName}'),
        actions: [
${
  context.hasAuth
    ? `          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: 'Mi Perfil',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfilePage()),
              );
            },
          ),`
    : ''
}
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.hub_outlined, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 8),
                      const Text(
                        'Conectado al Backend REST',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'API Base: \${ApiConstants.baseUrl}',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.2,
              ),
              delegate: SliverChildListDelegate([
${menuItems}
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureMenuCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  const _FeatureMenuCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 32, color: Theme.of(context).colorScheme.primary),
              const Spacer(),
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
`;
}

export function renderFlutterMain(context: ProjectContext): string {
  const imports: string[] = [
    "import 'package:flutter/material.dart';",
    "import 'package:flutter_bloc/flutter_bloc.dart';",
    "import 'core/theme/app_theme.dart';",
    "import 'features/home/presentation/pages/home_page.dart';",
    "import 'injection_container.dart' as di;",
  ];

  if (context.hasAuth) {
    imports.push("import 'features/auth/presentation/bloc/auth_bloc.dart';");
    imports.push("import 'features/auth/presentation/pages/login_page.dart';");
  }

  for (const meta of context.classes) {
    const snake = toSnakeCase(meta.className);
    imports.push(`import 'features/${snake}/presentation/bloc/${snake}_bloc.dart';`);
  }

  const blocProviders: string[] = [];

  if (context.hasAuth) {
    blocProviders.push(
      '        BlocProvider<AuthBloc>(create: (_) => di.sl<AuthBloc>()..add(AuthCheckRequested())),',
    );
  }

  for (const c of context.classes) {
    blocProviders.push(
      `        BlocProvider<${c.className}Bloc>(create: (_) => di.sl<${c.className}Bloc>()),`,
    );
  }

  const homeWidget = context.hasAuth
    ? `BlocBuilder<AuthBloc, AuthState>(
          builder: (context, state) {
            if (state is Authenticated) {
              return const HomePage();
            } else if (state is Unauthenticated || state is AuthFailureState) {
              return const LoginPage();
            }
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          },
        )`
    : 'const HomePage()';

  return `${imports.join('\n')}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await di.init();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
${blocProviders.join('\n')}
      ],
      child: MaterialApp(
        title: '${context.projectName}',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: ${homeWidget},
      ),
    );
  }
}
`;
}
