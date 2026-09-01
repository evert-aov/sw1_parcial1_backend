import { JavaClassMeta, toSnakeCase } from '../spring_boot/template-models';
import { getPluralName } from './flutter-models';

export function renderFlutterGetAllUseCase(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const snakePlural = getPluralName(snake);
  const classPlural = getPluralName(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../entities/${snake}_entity.dart';
import '../repositories/${snake}_repository.dart';

class Get${classPlural}UseCase {
  final ${meta.className}Repository repository;

  const Get${classPlural}UseCase({required this.repository});

  Future<Either<Failure, List<${meta.className}Entity>>> call() {
    return repository.getAll();
  }
}
`;
}

export function renderFlutterGetByIdUseCase(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../entities/${snake}_entity.dart';
import '../repositories/${snake}_repository.dart';

class Get${meta.className}ByIdUseCase {
  final ${meta.className}Repository repository;

  const Get${meta.className}ByIdUseCase({required this.repository});

  Future<Either<Failure, ${meta.className}Entity>> call(String id) {
    return repository.getById(id);
  }
}
`;
}

export function renderFlutterCreateUseCase(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../entities/${snake}_entity.dart';
import '../repositories/${snake}_repository.dart';

class Create${meta.className}UseCase {
  final ${meta.className}Repository repository;

  const Create${meta.className}UseCase({required this.repository});

  Future<Either<Failure, ${meta.className}Entity>> call(${meta.className}Entity entity) {
    return repository.create(entity);
  }
}
`;
}

export function renderFlutterUpdateUseCase(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../entities/${snake}_entity.dart';
import '../repositories/${snake}_repository.dart';

class Update${meta.className}UseCase {
  final ${meta.className}Repository repository;

  const Update${meta.className}UseCase({required this.repository});

  Future<Either<Failure, ${meta.className}Entity>> call(String id, ${meta.className}Entity entity) {
    return repository.update(id, entity);
  }
}
`;
}

export function renderFlutterDeleteUseCase(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);

  return `import 'package:dartz/dartz.dart';
import '../../../../core/errors/failures.dart';
import '../repositories/${snake}_repository.dart';

class Delete${meta.className}UseCase {
  final ${meta.className}Repository repository;

  const Delete${meta.className}UseCase({required this.repository});

  Future<Either<Failure, void>> call(String id) {
    return repository.delete(id);
  }
}
`;
}
