import { JavaClassMeta, toSnakeCase } from '../spring_boot/template-models';

export function renderFlutterDomainRepository(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../entities/${snake}_entity.dart';

abstract class ${meta.className}Repository {
  Future<Either<Failure, List<${meta.className}Entity>>> getAll();
  Future<Either<Failure, ${meta.className}Entity>> getById(String id);
  Future<Either<Failure, ${meta.className}Entity>> create(${meta.className}Entity entity);
  Future<Either<Failure, ${meta.className}Entity>> update(String id, ${meta.className}Entity entity);
  Future<Either<Failure, void>> delete(String id);
}
`;
}

export function renderFlutterDataRepository(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/${snake}_entity.dart';
import '../../domain/repositories/${snake}_repository.dart';
import '../datasources/${snake}_remote_datasource.dart';
import '../models/${snake}_request_model.dart';

class ${meta.className}RepositoryImpl implements ${meta.className}Repository {
  final ${meta.className}RemoteDataSource remoteDataSource;

  const ${meta.className}RepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, List<${meta.className}Entity>>> getAll() async {
    try {
      final models = await remoteDataSource.getAll();
      return Right(models);
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, ${meta.className}Entity>> getById(String id) async {
    try {
      final model = await remoteDataSource.getById(id);
      return Right(model);
    } on NotFoundException catch (e) {
      return Left(NotFoundFailure(message: e.message));
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, ${meta.className}Entity>> create(${meta.className}Entity entity) async {
    try {
      final request = ${meta.className}RequestModel.fromEntity(entity);
      final model = await remoteDataSource.create(request);
      return Right(model);
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, ${meta.className}Entity>> update(String id, ${meta.className}Entity entity) async {
    try {
      final request = ${meta.className}RequestModel.fromEntity(entity);
      final model = await remoteDataSource.update(id, request);
      return Right(model);
    } on NotFoundException catch (e) {
      return Left(NotFoundFailure(message: e.message));
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> delete(String id) async {
    try {
      await remoteDataSource.delete(id);
      return const Right(null);
    } on NotFoundException catch (e) {
      return Left(NotFoundFailure(message: e.message));
    } on NetworkException catch (e) {
      return Left(NetworkFailure(message: e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(message: e.message, statusCode: e.statusCode));
    } catch (e) {
      return Left(ServerFailure(message: e.toString()));
    }
  }
}
`;
}
