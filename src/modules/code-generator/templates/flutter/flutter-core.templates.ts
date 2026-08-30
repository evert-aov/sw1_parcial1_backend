import { ProjectContext, toSnakeCase } from '../template-models';

export function renderApiConstants(context: ProjectContext): string {
  const port = context.serverPort || 8080;
  return `import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

/// Constantes globales de configuración de red y endpoints para la API REST de Spring Boot.
class ApiConstants {
  // Para pruebas vía cable USB (adb reverse tcp:${port} tcp:${port}) o emuladores:
  // - En Dispositivo Físico con USB 'adb reverse': usar 'http://localhost:${port}/api/v1'
  // - En Emulador Android estándar: usar 'http://10.0.2.2:${port}/api/v1'
  // - En iOS Simulator / Web / Desktop: usar 'http://localhost:${port}/api/v1'
  
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:${port}/api/v1';
    }
    if (Platform.isAndroid) {
      // Si utilizas 'adb reverse tcp:${port} tcp:${port}' desde tu PC por cable USB:
      return 'http://localhost:${port}/api/v1';
      // Si utilizas el emulador de Android Studio sin adb reverse, descomenta:
      // return 'http://10.0.2.2:${port}/api/v1';
    }
    return 'http://localhost:${port}/api/v1';
  }

  static const int connectTimeout = 15000;
  static const int receiveTimeout = 15000;

  // Endpoints REST de las entidades
${context.classes
  .map(
    (c) =>
      `  static const String ${toCamelCase(c.className)}Endpoint = '/${c.tableName.replace(/_/g, '-')}';`,
  )
  .join('\n')}
}
`;
}

export function renderExceptions(): string {
  return `/// Excepciones lanzadas por el Data Layer al comunicarse con la API REST.
class ServerException implements Exception {
  final String message;
  final int? statusCode;

  const ServerException({
    required this.message,
    this.statusCode,
  });

  @override
  String toString() => 'ServerException(statusCode: \$statusCode, message: \$message)';
}

class NetworkException implements Exception {
  final String message;

  const NetworkException({required this.message});

  @override
  String toString() => 'NetworkException(message: \$message)';
}

class NotFoundException implements Exception {
  final String message;

  const NotFoundException({required this.message});

  @override
  String toString() => 'NotFoundException(message: \$message)';
}
`;
}

export function renderFailures(): string {
  return `import 'package:equatable/equatable.dart';

/// Clase base para representar fallos en la capa de Dominio (Clean Architecture).
abstract class Failure extends Equatable {
  final String message;

  const Failure({required this.message});

  @override
  List<Object?> get props => [message];
}

class ServerFailure extends Failure {
  final int? statusCode;

  const ServerFailure({
    required super.message,
    this.statusCode,
  });

  @override
  List<Object?> get props => [message, statusCode];
}

class NetworkFailure extends Failure {
  const NetworkFailure({required super.message});
}

class NotFoundFailure extends Failure {
  const NotFoundFailure({required super.message});
}
`;
}

export function renderApiClient(): string {
  return `import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../errors/exceptions.dart';

/// Cliente HTTP unificado basado en Dio con interceptores de logging y manejo de errores.
class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(milliseconds: ApiConstants.connectTimeout),
        receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      LogInterceptor(
        request: true,
        requestHeader: true,
        requestBody: true,
        responseHeader: false,
        responseBody: true,
        error: true,
      ),
    );
  }

  Dio get client => _dio;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Exception _handleDioError(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.connectionError) {
      return const NetworkException(
        message: 'No se pudo conectar con el servidor. Verifica tu conexión y que el backend esté corriendo.',
      );
    }

    final statusCode = error.response?.statusCode;
    final message = error.response?.data is Map && error.response?.data['message'] != null
        ? error.response?.data['message']
        : error.message ?? 'Error inesperado en el servidor';

    if (statusCode == 404) {
      return NotFoundException(message: message);
    }

    return ServerException(
      message: message,
      statusCode: statusCode,
    );
  }
}
`;
}

export function renderAppTheme(): string {
  return `import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tema visual moderno y limpio Material 3 para la aplicación Flutter.
class AppTheme {
  static const Color primaryColor = Color(0xFF6B5A52);
  static const Color primaryLight = Color(0xFF8D7B72);
  static const Color primaryDark = Color(0xFF43342D);
  static const Color accentColor = Color(0xFF0F766E);
  static const Color backgroundColor = Color(0xFFF9F7F5);
  static const Color surfaceColor = Colors.white;
  static const Color errorColor = Color(0xFFDC2626);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: primaryColor,
        secondary: accentColor,
        surface: surfaceColor,
        background: backgroundColor,
        error: errorColor,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: backgroundColor,
      textTheme: GoogleFonts.interTextTheme(),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 2,
        shadowColor: Colors.black.withOpacity(0.08),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0xFFE5E0DC), width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFD1C7C1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFD1C7C1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: errorColor),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 4,
      ),
    );
  }
}
`;
}
