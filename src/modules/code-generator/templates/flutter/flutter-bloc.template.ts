import { JavaClassMeta, toSnakeCase, toCamelCase } from '../template-models';
import { getPluralName } from './flutter-models';

export function renderFlutterBlocEvents(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const classPlural = getPluralName(meta.className);

  return `import 'package:equatable/equatable.dart';
import '../../domain/entities/${snake}_entity.dart';

abstract class ${meta.className}Event extends Equatable {
  const ${meta.className}Event();

  @override
  List<Object?> get props => [];
}

class Load${classPlural}Event extends ${meta.className}Event {
  const Load${classPlural}Event();
}

class Get${meta.className}ByIdEvent extends ${meta.className}Event {
  final String id;

  const Get${meta.className}ByIdEvent(this.id);

  @override
  List<Object?> get props => [id];
}

class Create${meta.className}Event extends ${meta.className}Event {
  final ${meta.className}Entity entity;

  const Create${meta.className}Event(this.entity);

  @override
  List<Object?> get props => [entity];
}

class Update${meta.className}Event extends ${meta.className}Event {
  final String id;
  final ${meta.className}Entity entity;

  const Update${meta.className}Event({required this.id, required this.entity});

  @override
  List<Object?> get props => [id, entity];
}

class Delete${meta.className}Event extends ${meta.className}Event {
  final String id;

  const Delete${meta.className}Event(this.id);

  @override
  List<Object?> get props => [id];
}
`;
}

export function renderFlutterBlocStates(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const camel = toCamelCase(meta.className);
  const classPlural = getPluralName(meta.className);
  const camelPlural = toCamelCase(classPlural);

  return `import 'package:equatable/equatable.dart';
import '../../domain/entities/${snake}_entity.dart';

abstract class ${meta.className}State extends Equatable {
  const ${meta.className}State();

  @override
  List<Object?> get props => [];
}

class ${meta.className}InitialState extends ${meta.className}State {}

class ${meta.className}LoadingState extends ${meta.className}State {}

class ${classPlural}LoadedState extends ${meta.className}State {
  final List<${meta.className}Entity> ${camelPlural};

  const ${classPlural}LoadedState(this.${camelPlural});

  @override
  List<Object?> get props => [${camelPlural}];
}

class ${meta.className}DetailLoadedState extends ${meta.className}State {
  final ${meta.className}Entity ${camel};

  const ${meta.className}DetailLoadedState(this.${camel});

  @override
  List<Object?> get props => [${camel}];
}

class ${meta.className}OperationSuccessState extends ${meta.className}State {
  final String message;

  const ${meta.className}OperationSuccessState(this.message);

  @override
  List<Object?> get props => [message];
}

class ${meta.className}ErrorState extends ${meta.className}State {
  final String message;

  const ${meta.className}ErrorState(this.message);

  @override
  List<Object?> get props => [message];
}
`;
}

export function renderFlutterBloc(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const classPlural = getPluralName(meta.className);
  const snakePlural = getPluralName(snake);

  return `import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_${snakePlural}_usecase.dart';
import '../../domain/usecases/get_${snake}_by_id_usecase.dart';
import '../../domain/usecases/create_${snake}_usecase.dart';
import '../../domain/usecases/update_${snake}_usecase.dart';
import '../../domain/usecases/delete_${snake}_usecase.dart';
import '${snake}_event.dart';
import '${snake}_state.dart';

class ${meta.className}Bloc extends Bloc<${meta.className}Event, ${meta.className}State> {
  final Get${classPlural}UseCase get${classPlural}UseCase;
  final Get${meta.className}ByIdUseCase get${meta.className}ByIdUseCase;
  final Create${meta.className}UseCase create${meta.className}UseCase;
  final Update${meta.className}UseCase update${meta.className}UseCase;
  final Delete${meta.className}UseCase delete${meta.className}UseCase;

  ${meta.className}Bloc({
    required this.get${classPlural}UseCase,
    required this.get${meta.className}ByIdUseCase,
    required this.create${meta.className}UseCase,
    required this.update${meta.className}UseCase,
    required this.delete${meta.className}UseCase,
  }) : super(${meta.className}InitialState()) {
    on<Load${classPlural}Event>(_onLoad${classPlural});
    on<Get${meta.className}ByIdEvent>(_onGet${meta.className}ById);
    on<Create${meta.className}Event>(_onCreate${meta.className});
    on<Update${meta.className}Event>(_onUpdate${meta.className});
    on<Delete${meta.className}Event>(_onDelete${meta.className});
  }

  Future<void> _onLoad${classPlural}(
    Load${classPlural}Event event,
    Emitter<${meta.className}State> emit,
  ) async {
    emit(${meta.className}LoadingState());
    final result = await get${classPlural}UseCase();
    result.fold(
      (failure) => emit(${meta.className}ErrorState(failure.message)),
      (items) => emit(${classPlural}LoadedState(items)),
    );
  }

  Future<void> _onGet${meta.className}ById(
    Get${meta.className}ByIdEvent event,
    Emitter<${meta.className}State> emit,
  ) async {
    emit(${meta.className}LoadingState());
    final result = await get${meta.className}ByIdUseCase(event.id);
    result.fold(
      (failure) => emit(${meta.className}ErrorState(failure.message)),
      (item) => emit(${meta.className}DetailLoadedState(item)),
    );
  }

  Future<void> _onCreate${meta.className}(
    Create${meta.className}Event event,
    Emitter<${meta.className}State> emit,
  ) async {
    emit(${meta.className}LoadingState());
    final result = await create${meta.className}UseCase(event.entity);
    result.fold(
      (failure) => emit(${meta.className}ErrorState(failure.message)),
      (_) {
        emit(const ${meta.className}OperationSuccessState('${meta.className} creado exitosamente'));
        add(const Load${classPlural}Event());
      },
    );
  }

  Future<void> _onUpdate${meta.className}(
    Update${meta.className}Event event,
    Emitter<${meta.className}State> emit,
  ) async {
    emit(${meta.className}LoadingState());
    final result = await update${meta.className}UseCase(event.id, event.entity);
    result.fold(
      (failure) => emit(${meta.className}ErrorState(failure.message)),
      (_) {
        emit(const ${meta.className}OperationSuccessState('${meta.className} actualizado exitosamente'));
        add(const Load${classPlural}Event());
      },
    );
  }

  Future<void> _onDelete${meta.className}(
    Delete${meta.className}Event event,
    Emitter<${meta.className}State> emit,
  ) async {
    emit(${meta.className}LoadingState());
    final result = await delete${meta.className}UseCase(event.id);
    result.fold(
      (failure) => emit(${meta.className}ErrorState(failure.message)),
      (_) {
        emit(const ${meta.className}OperationSuccessState('${meta.className} eliminado exitosamente'));
        add(const Load${classPlural}Event());
      },
    );
  }
}
`;
}
