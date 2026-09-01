import { JavaClassMeta, toSnakeCase } from '../spring_boot/template-models';
import { getDartFields } from './flutter-models';

export function renderFlutterModel(meta: JavaClassMeta): string {
  const dartFields = getDartFields(meta);
  const snake = toSnakeCase(meta.className);

  const constructorSuperParams = dartFields
    .map((f) => {
      if (f.isNullable && !f.isId) {
        return `    super.${f.name},`;
      }
      return `    required super.${f.name},`;
    })
    .join('\n');

  const fromJsonFields = dartFields
    .map((f) => {
      if (f.isDateTime) {
        return `      ${f.name}: json['${f.jsonKey}'] != null ? DateTime.parse(json['${f.jsonKey}'].toString()) : ${f.isNullable ? 'null' : 'DateTime.now()'},`;
      }
      if (f.dartType === 'int') {
        return `      ${f.name}: json['${f.jsonKey}'] != null ? int.tryParse(json['${f.jsonKey}'].toString()) ?? 0 : 0,`;
      }
      if (f.dartType === 'double') {
        return `      ${f.name}: json['${f.jsonKey}'] != null ? double.tryParse(json['${f.jsonKey}'].toString()) ?? 0.0 : 0.0,`;
      }
      if (f.dartType === 'bool') {
        return `      ${f.name}: json['${f.jsonKey}'] == true || json['${f.jsonKey}'] == 'true' || json['${f.jsonKey}'] == 1,`;
      }
      return `      ${f.name}: json['${f.jsonKey}']?.toString() ?? '',`;
    })
    .join('\n');

  const toJsonFields = dartFields
    .map((f) => {
      if (f.isDateTime) {
        return `      '${f.jsonKey}': ${f.name}${f.isNullable ? '?' : ''}.toIso8601String(),`;
      }
      return `      '${f.jsonKey}': ${f.name},`;
    })
    .join('\n');

  const fromEntityParams = dartFields.map((f) => `      ${f.name}: entity.${f.name},`).join('\n');

  return `import '../../domain/entities/${snake}_entity.dart';

/// Modelo de datos serializable para ${meta.className} con soporte JSON.
class ${meta.className}Model extends ${meta.className}Entity {
  const ${meta.className}Model({
${constructorSuperParams}
  });

  factory ${meta.className}Model.fromJson(Map<String, dynamic> json) {
    return ${meta.className}Model(
${fromJsonFields}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonFields}
    };
  }

  factory ${meta.className}Model.fromEntity(${meta.className}Entity entity) {
    return ${meta.className}Model(
${fromEntityParams}
    );
  }
}
`;
}

export function renderFlutterRequestModel(meta: JavaClassMeta): string {
  const dartFields = getDartFields(meta).filter((f) => !f.isId);
  const snake = toSnakeCase(meta.className);

  const fieldsDef = dartFields
    .map((f) => `  final ${f.dartType}${f.isNullable ? '?' : ''} ${f.name};`)
    .join('\n');

  const constructorParams = dartFields
    .map((f) => {
      if (f.isNullable) {
        return `    this.${f.name},`;
      }
      return `    required this.${f.name},`;
    })
    .join('\n');

  const toCreateJsonFields = dartFields
    .map((f) => {
      if (f.isDateTime) {
        return `      '${f.name}': ${f.name}${f.isNullable ? '?' : ''}.toIso8601String(),`;
      }
      return `      '${f.name}': ${f.name},`;
    })
    .join('\n');

  const fromEntityParams = dartFields.map((f) => `      ${f.name}: entity.${f.name},`).join('\n');

  return `import '../../domain/entities/${snake}_entity.dart';

/// DTO de solicitud para crear y actualizar ${meta.className}.
class ${meta.className}RequestModel {
${fieldsDef}

  const ${meta.className}RequestModel({
${constructorParams}
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
${dartFields
  .map((f) => {
    if (f.isDateTime) {
      return `    if (${f.name} != null) map['${f.name}'] = ${f.name}!.toIso8601String();`;
    }
    return `    if (${f.name} != null) map['${f.name}'] = ${f.name};`;
  })
  .join('\n')}
    return map;
  }

  factory ${meta.className}RequestModel.fromEntity(${meta.className}Entity entity) {
    return ${meta.className}RequestModel(
${fromEntityParams}
    );
  }
}
`;
}
