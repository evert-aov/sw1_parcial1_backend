import {
  JavaClassMeta,
  ProjectContext,
  toSnakeCase,
  getUserEmailField,
  getUserPasswordField,
} from '../spring_boot/template-models';

/**
 * Renderiza el servicio de almacenamiento seguro y en memoria del token JWT.
 */
export function renderFlutterTokenStorageService(): string {
  return `import 'package:shared_preferences/shared_preferences.dart';

/// Servicio para persistir y recuperar el token JWT en el almacenamiento local del dispositivo.
class TokenStorageService {
  static const String _tokenKey = 'jwt_auth_token';
  static const String _userKey = 'jwt_auth_user';
  static String? _cachedToken;

  static String? getToken() {
    return _cachedToken;
  }

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedToken = prefs.getString(_tokenKey);
  }

  static Future<void> saveToken(String token) async {
    _cachedToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> saveUserData(String userDataJson) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, userDataJson);
  }

  static Future<String?> getUserData() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_userKey);
  }

  static Future<void> clear() async {
    _cachedToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  static bool get isAuthenticated => _cachedToken != null && _cachedToken!.isNotEmpty;
}
`;
}

/**
 * Renderiza los modelos DTO de Autenticación para Flutter.
 */
export function renderFlutterAuthModels(userMeta: JavaClassMeta): string {
  const userSnake = toSnakeCase(userMeta.className);

  return `import '../../../${userSnake}/data/models/${userSnake}_model.dart';

/// Modelo de respuesta del login/registro conteniendo el JWT Token y datos del usuario.
class AuthResponseModel {
  final String token;
  final String tokenType;
  final ${userMeta.className}Model? user;

  const AuthResponseModel({
    required this.token,
    this.tokenType = 'Bearer',
    this.user,
  });

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    return AuthResponseModel(
      token: json['token'] as String? ?? '',
      tokenType: json['tokenType'] as String? ?? 'Bearer',
      user: json['user'] != null && json['user'] is Map<String, dynamic>
          ? ${userMeta.className}Model.fromJson(json['user'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'tokenType': tokenType,
      'user': user?.toJson(),
    };
  }
}

class LoginRequestModel {
  final String email;
  final String password;

  const LoginRequestModel({
    required this.email,
    required this.password,
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
    };
  }
}

class RegisterRequestModel {
  final String email;
  final String password;
  final Map<String, dynamic> additionalFields;

  const RegisterRequestModel({
    required this.email,
    required this.password,
    this.additionalFields = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
      ...additionalFields,
    };
  }
}
`;
}

/**
 * Renderiza el DataSource remoto para comunicarse con /api/v1/auth.
 */
export function renderFlutterAuthRemoteDataSource(): string {
  return `import '../../../../core/network/api_client.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/services/token_storage_service.dart';
import '../models/auth_models.dart';

abstract class AuthRemoteDataSource {
  Future<AuthResponseModel> login(LoginRequestModel request);
  Future<AuthResponseModel> register(RegisterRequestModel request);
  Future<void> logout();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final ApiClient apiClient;

  AuthRemoteDataSourceImpl({required this.apiClient});

  @override
  Future<AuthResponseModel> login(LoginRequestModel request) async {
    final response = await apiClient.post(
      '/auth/login',
      data: request.toJson(),
    );

    if (response.statusCode == 200 && response.data != null) {
      final authModel = AuthResponseModel.fromJson(response.data as Map<String, dynamic>);
      await TokenStorageService.saveToken(authModel.token);
      return authModel;
    } else {
      throw ServerException(
        message: 'Credenciales inválidas',
        statusCode: response.statusCode,
      );
    }
  }

  @override
  Future<AuthResponseModel> register(RegisterRequestModel request) async {
    final response = await apiClient.post(
      '/auth/register',
      data: request.toJson(),
    );

    if ((response.statusCode == 200 || response.statusCode == 201) && response.data != null) {
      final authModel = AuthResponseModel.fromJson(response.data as Map<String, dynamic>);
      await TokenStorageService.saveToken(authModel.token);
      return authModel;
    } else {
      throw ServerException(
        message: 'No se pudo completar el registro',
        statusCode: response.statusCode,
      );
    }
  }

  @override
  Future<void> logout() async {
    await TokenStorageService.clear();
  }
}
`;
}

/**
 * Renderiza la interfaz de Dominio del Repositorio de Auth.
 */
export function renderFlutterAuthDomainRepository(userMeta: JavaClassMeta): string {
  const userSnake = toSnakeCase(userMeta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../../../${userSnake}/domain/entities/${userSnake}_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, ${userMeta.className}Entity>> login(String email, String password);
  Future<Either<Failure, ${userMeta.className}Entity>> register(String email, String password, Map<String, dynamic> extra);
  Future<Either<Failure, void>> logout();
  Future<bool> checkAuthStatus();
}
`;
}

/**
 * Renderiza la Implementación de Datos del Repositorio de Auth.
 */
export function renderFlutterAuthDataRepository(userMeta: JavaClassMeta): string {
  const userSnake = toSnakeCase(userMeta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/services/token_storage_service.dart';
import '../../../${userSnake}/domain/entities/${userSnake}_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/auth_models.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;

  AuthRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, ${userMeta.className}Entity>> login(String email, String password) async {
    try {
      final result = await remoteDataSource.login(
        LoginRequestModel(email: email, password: password),
      );
      if (result.user != null) {
        return Right(result.user!);
      }
      return Left(ServerFailure(message: 'Respuesta inválida del servidor'));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, ${userMeta.className}Entity>> register(
    String email,
    String password,
    Map<String, dynamic> extra,
  ) async {
    try {
      final result = await remoteDataSource.register(
        RegisterRequestModel(email: email, password: password, additionalFields: extra),
      );
      if (result.user != null) {
        return Right(result.user!);
      }
      return Left(ServerFailure(message: 'Respuesta inválida del servidor'));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    try {
      await remoteDataSource.logout();
      return const Right(null);
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<bool> checkAuthStatus() async {
    return TokenStorageService.isAuthenticated;
  }
}
`;
}

/**
 * Renderiza los casos de uso para la autenticación en Flutter.
 */
export function renderFlutterAuthUseCases(userMeta: JavaClassMeta): string {
  const userSnake = toSnakeCase(userMeta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../../../${userSnake}/domain/entities/${userSnake}_entity.dart';
import '../repositories/auth_repository.dart';

class LoginUseCase {
  final AuthRepository repository;
  LoginUseCase({required this.repository});

  Future<Either<Failure, ${userMeta.className}Entity>> call(String email, String password) {
    return repository.login(email, password);
  }
}

class RegisterUseCase {
  final AuthRepository repository;
  RegisterUseCase({required this.repository});

  Future<Either<Failure, ${userMeta.className}Entity>> call(String email, String password, Map<String, dynamic> extra) {
    return repository.register(email, password, extra);
  }
}

class LogoutUseCase {
  final AuthRepository repository;
  LogoutUseCase({required this.repository});

  Future<Either<Failure, void>> call() {
    return repository.logout();
  }
}

class CheckAuthUseCase {
  final AuthRepository repository;
  CheckAuthUseCase({required this.repository});

  Future<bool> call() {
    return repository.checkAuthStatus();
  }
}
`;
}

/**
 * Renderiza el BLoC de Autenticación (Events, States y BLoC).
 */
export function renderFlutterAuthBloc(userMeta: JavaClassMeta): string {
  const userSnake = toSnakeCase(userMeta.className);

  return `import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../${userSnake}/domain/entities/${userSnake}_entity.dart';
import '../../domain/usecases/auth_usecases.dart';

// ==================== EVENTS ====================
abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

class AuthCheckRequested extends AuthEvent {}

class LoginSubmitted extends AuthEvent {
  final String email;
  final String password;

  const LoginSubmitted({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

class RegisterSubmitted extends AuthEvent {
  final String email;
  final String password;
  final Map<String, dynamic> extra;

  const RegisterSubmitted({
    required this.email,
    required this.password,
    this.extra = const {},
  });

  @override
  List<Object?> get props => [email, password, extra];
}

class LogoutSubmitted extends AuthEvent {}

// ==================== STATES ====================
abstract class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class Authenticated extends AuthState {
  final ${userMeta.className}Entity? user;
  const Authenticated({this.user});

  @override
  List<Object?> get props => [user];
}

class Unauthenticated extends AuthState {}

class AuthFailureState extends AuthState {
  final String message;
  const AuthFailureState({required this.message});

  @override
  List<Object?> get props => [message];
}

// ==================== BLOC ====================
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final LoginUseCase loginUseCase;
  final RegisterUseCase registerUseCase;
  final LogoutUseCase logoutUseCase;
  final CheckAuthUseCase checkAuthUseCase;

  AuthBloc({
    required this.loginUseCase,
    required this.registerUseCase,
    required this.logoutUseCase,
    required this.checkAuthUseCase,
  }) : super(AuthInitial()) {
    on<AuthCheckRequested>((event, emit) async {
      final isAuth = await checkAuthUseCase();
      if (isAuth) {
        emit(const Authenticated());
      } else {
        emit(Unauthenticated());
      }
    });

    on<LoginSubmitted>((event, emit) async {
      emit(AuthLoading());
      final result = await loginUseCase(event.email, event.password);
      result.fold(
        (failure) => emit(AuthFailureState(message: failure.message)),
        (user) => emit(Authenticated(user: user)),
      );
    });

    on<RegisterSubmitted>((event, emit) async {
      emit(AuthLoading());
      final result = await registerUseCase(event.email, event.password, event.extra);
      result.fold(
        (failure) => emit(AuthFailureState(message: failure.message)),
        (user) => emit(Authenticated(user: user)),
      );
    });

    on<LogoutSubmitted>((event, emit) async {
      emit(AuthLoading());
      await logoutUseCase();
      emit(Unauthenticated());
    });
  }
}
`;
}

/**
 * Renderiza la pantalla LoginPage con diseño profesional.
 */
export function renderFlutterLoginPage(context: ProjectContext): string {
  return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth_bloc.dart';
import 'register_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'admin@studio.com');
  final _passwordController = TextEditingController(text: 'admin123');
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            LoginSubmitted(
              email: _emailController.text.trim(),
              password: _passwordController.text.trim(),
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthFailureState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: theme.colorScheme.error,
              ),
            );
          }
        },
        builder: (context, state) {
          final isLoading = state is AuthLoading;

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  elevation: 4,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Icon(
                            Icons.lock_person_outlined,
                            size: 56,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Iniciar Sesión',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${context.projectName}',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 28),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Correo Electrónico o Usuario',
                              prefixIcon: Icon(Icons.email_outlined),
                            ),
                            validator: (v) =>
                                v == null || v.trim().isEmpty ? 'Ingresa tu usuario o correo' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Contraseña',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (v) =>
                                v == null || v.trim().isEmpty ? 'Ingresa tu contraseña' : null,
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: isLoading ? null : _submit,
                            child: isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('INGRESAR', style: TextStyle(fontSize: 16)),
                          ),
                          const SizedBox(height: 16),
                          TextButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const RegisterPage()),
                              );
                            },
                            child: const Text('¿No tienes cuenta? Regístrate aquí'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
`;
}

/**
 * Renderiza la pantalla RegisterPage.
 */
export function renderFlutterRegisterPage(context: ProjectContext, userMeta: JavaClassMeta): string {
  const emailField = getUserEmailField(userMeta);
  const passField = getUserPasswordField(userMeta);
  const regularFields = userMeta.fields.filter(
    (f) => !f.isId && f.name !== passField.name && f.name !== emailField.name,
  );

  const controllersDef = regularFields
    .map((f) => `  final _${f.name}Controller = TextEditingController();`)
    .join('\n');

  const disposeControllers = regularFields
    .map((f) => `    _${f.name}Controller.dispose();`)
    .join('\n');

  const extraDataEntries = regularFields
    .map((f) => {
      if (f.javaType === 'Integer' || f.javaType === 'Long') {
        return `        '${f.name}': int.tryParse(_${f.name}Controller.text.trim()) ?? 0,`;
      }
      if (f.javaType === 'Double' || f.javaType === 'Float' || f.javaType === 'BigDecimal') {
        return `        '${f.name}': double.tryParse(_${f.name}Controller.text.trim()) ?? 0.0,`;
      }
      if (f.javaType === 'Boolean') {
        return `        '${f.name}': _${f.name}Controller.text.trim().toLowerCase() == 'true',`;
      }
      return `        '${f.name}': _${f.name}Controller.text.trim(),`;
    })
    .join('\n');

  const regularFieldsWidgets = regularFields
    .map((f) => {
      const label = f.name.charAt(0).toUpperCase() + f.name.slice(1);
      const isNum = f.javaType === 'Integer' || f.javaType === 'Long' || f.javaType === 'Double' || f.javaType === 'BigDecimal';
      return `                          TextFormField(
                            controller: _${f.name}Controller,
                            keyboardType: ${isNum ? 'TextInputType.number' : 'TextInputType.text'},
                            decoration: const InputDecoration(
                              labelText: '${label}',
                              prefixIcon: Icon(Icons.edit_note_outlined),
                            ),
                            validator: (v) =>
                                ${!f.isNullable ? `v == null || v.trim().isEmpty ? 'El campo ${label} es obligatorio' : null` : 'null'},
                          ),
                          const SizedBox(height: 16),`;
    })
    .join('\n');

  const emailLabel = emailField.name.charAt(0).toUpperCase() + emailField.name.slice(1);

  return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth_bloc.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
${controllersDef}
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
${disposeControllers}
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      if (_passwordController.text != _confirmPasswordController.text) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Las contraseñas no coinciden')),
        );
        return;
      }

      final extraData = <String, dynamic>{
${extraDataEntries}
      };

      context.read<AuthBloc>().add(
            RegisterSubmitted(
              email: _emailController.text.trim(),
              password: _passwordController.text.trim(),
              extra: extraData,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Crear Cuenta')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is Authenticated) {
            Navigator.pop(context);
          } else if (state is AuthFailureState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: theme.colorScheme.error,
              ),
            );
          }
        },
        builder: (context, state) {
          final isLoading = state is AuthLoading;

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  elevation: 4,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Registro de ${userMeta.className}',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                          const SizedBox(height: 24),
${regularFieldsWidgets}
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: '${emailLabel}',
                              prefixIcon: Icon(Icons.email_outlined),
                            ),
                            validator: (v) =>
                                v == null || v.trim().isEmpty ? 'Ingresa un ${emailLabel.toLowerCase()}' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Contraseña',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (v) =>
                                v == null || v.length < 6 ? 'Mínimo 6 caracteres' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _confirmPasswordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Confirmar Contraseña',
                              prefixIcon: const Icon(Icons.lock_clock_outlined),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (v) =>
                                v == null || v.isEmpty ? 'Confirma tu contraseña' : null,
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: isLoading ? null : _submit,
                            child: isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('REGISTRARSE'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
`;
}

/**
 * Renderiza la pantalla ProfilePage con opción de cerrar sesión.
 */
export function renderFlutterProfilePage(context: ProjectContext, userMeta: JavaClassMeta): string {
  return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth_bloc.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Perfil'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 48,
                backgroundColor: theme.colorScheme.primary.withOpacity(0.15),
                child: Icon(
                  Icons.person,
                  size: 56,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Sesión Activa',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Autenticado mediante Token JWT en ${context.projectName}',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.error,
                ),
                onPressed: () {
                  context.read<AuthBloc>().add(LogoutSubmitted());
                  Navigator.pop(context);
                },
                icon: const Icon(Icons.logout),
                label: const Text('CERRAR SESIÓN'),
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
