import { JavaClassMeta, toSnakeCase } from '../spring_boot/template-models';
import { getDartFields } from './flutter-models';

export function renderFlutterEntity(meta: JavaClassMeta): string {
  const dartFields = getDartFields(meta);

  const fieldsDef = dartFields
    .map((f) => `  final ${f.dartType}${f.isNullable && !f.isId ? '?' : ''} ${f.name};`)
    .join('\n');

  const constructorParams = dartFields
    .map((f) => {
      if (f.isNullable && !f.isId) {
        return `    this.${f.name},`;
      }
      return `    required this.${f.name},`;
    })
    .join('\n');

  const propsList = dartFields.map((f) => f.name).join(', ');

  return `import 'package:equatable/equatable.dart';

/// Entidad pura de Dominio para ${meta.className} (Clean Architecture).
class ${meta.className}Entity extends Equatable {
${fieldsDef}

  const ${meta.className}Entity({
${constructorParams}
  });

  @override
  List<Object?> get props => [${propsList}];
}
`;
}
