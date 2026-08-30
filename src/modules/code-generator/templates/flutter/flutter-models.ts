import { JavaClassMeta, JavaField, toCamelCase, toPascalCase, toSnakeCase } from '../template-models';

export interface DartField {
  name: string;
  dartType: string;
  jsonKey: string;
  isId: boolean;
  isNullable: boolean;
  isDateTime: boolean;
  isNumber: boolean;
  isBoolean: boolean;
  isString: boolean;
  defaultValue: string;
}

export function mapJavaTypeToDart(javaType: string): string {
  const norm = (javaType || 'String').trim().toLowerCase();
  switch (norm) {
    case 'uuid':
    case 'string':
    case 'text':
      return 'String';
    case 'int':
    case 'integer':
      return 'int';
    case 'long':
      return 'int';
    case 'double':
    case 'float':
    case 'bigdecimal':
      return 'double';
    case 'boolean':
    case 'bool':
      return 'bool';
    case 'localdate':
    case 'localdatetime':
    case 'date':
    case 'timestamp':
      return 'DateTime';
    default:
      return 'String';
  }
}

export function getDartFields(meta: JavaClassMeta): DartField[] {
  return meta.fields.map((f) => {
    const dartType = mapJavaTypeToDart(f.javaType);
    const isDateTime = dartType === 'DateTime';
    const isNumber = dartType === 'int' || dartType === 'double';
    const isBoolean = dartType === 'bool';
    const isString = dartType === 'String';

    let defaultValue = "''";
    if (dartType === 'int') defaultValue = '0';
    if (dartType === 'double') defaultValue = '0.0';
    if (dartType === 'bool') defaultValue = 'false';
    if (dartType === 'DateTime') defaultValue = 'DateTime.now()';

    return {
      name: f.name,
      dartType,
      jsonKey: f.sqlColumnName || f.name,
      isId: f.isId,
      isNullable: f.isNullable,
      isDateTime,
      isNumber,
      isBoolean,
      isString,
      defaultValue,
    };
  });
}

export function getPluralName(name: string): string {
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z')) {
    return name + 'es';
  }
  return name + 's';
}
