export interface JavaField {
  name: string;
  javaType: string;
  sqlColumnName: string;
  sqlType: string;
  isId: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  getterName: string;
  setterName: string;
}

export interface JavaRelationship {
  type: 'MANY_TO_ONE' | 'ONE_TO_MANY' | 'ONE_TO_ONE' | 'MANY_TO_MANY';
  targetClassName: string;
  targetPackage: string;
  fieldName: string;
  joinColumnName?: string;
  mappedBy?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  cascade?: string;
}

export interface JavaClassMeta {
  className: string;
  tableName: string;
  packageName: string;
  basePackage: string;
  idField: JavaField;
  fields: JavaField[];
  methods: {
    name: string;
    parameters: string;
    returnType: string;
  }[];
  relationships: JavaRelationship[];
  hasDates: boolean;
  hasUuids: boolean;
  hasBigDecimals: boolean;
}

export interface ProjectContext {
  packageName: string;
  artifactId: string;
  groupId: string;
  projectName: string;
  javaVersion: string;
  springBootVersion: string;
  databaseName: string;
  databaseUser: string;
  databasePassword: string;
  databasePort: number;
  serverPort: number;
  classes: JavaClassMeta[];
  hasAuth?: boolean;
  userClass?: JavaClassMeta;
}

export function isUserClass(target: string | JavaClassMeta): boolean {
  const name = typeof target === 'string' ? target : target.className;
  const lower = name.toLowerCase().trim();
  const userKeywords = [
    'user',
    'usuario',
    'users',
    'usuarios',
    'account',
    'cuenta',
    'cuentas',
    'accounts',
    'appuser',
    'customuser',
    'cliente',
    'authuser',
    'persona',
  ];
  return userKeywords.includes(lower) || lower.endsWith('user') || lower.endsWith('usuario');
}

export function toPascalCase(str: string): string {
  if (!str) return 'Entity';
  const clean = str.replace(/[^a-zA-Z0-9_]/g, '');
  return clean
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
  if (!str) return 'table_name';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function mapTypeToSql(javaType: string): string {
  const norm = (javaType || 'String').trim();
  switch (norm.toLowerCase()) {
    case 'uuid':
      return 'UUID';
    case 'string':
    case 'text':
      return 'VARCHAR(255)';
    case 'int':
    case 'integer':
      return 'INTEGER';
    case 'long':
      return 'BIGINT';
    case 'boolean':
    case 'bool':
      return 'BOOLEAN';
    case 'double':
      return 'DOUBLE PRECISION';
    case 'float':
      return 'REAL';
    case 'bigdecimal':
      return 'NUMERIC(15, 2)';
    case 'localdate':
    case 'date':
      return 'DATE';
    case 'localdatetime':
    case 'timestamp':
      return 'TIMESTAMP';
    case 'byte[]':
      return 'BYTEA';
    default:
      return 'VARCHAR(255)';
  }
}

export function normalizeJavaType(type: string): string {
  if (!type) return 'String';
  const trimmed = type.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'uuid') return 'UUID';
  if (lower === 'string' || lower === 'text') return 'String';
  if (lower === 'integer' || lower === 'int') return 'Integer';
  if (lower === 'long') return 'Long';
  if (lower === 'boolean' || lower === 'bool') return 'Boolean';
  if (lower === 'double') return 'Double';
  if (lower === 'float') return 'Float';
  if (lower === 'bigdecimal') return 'BigDecimal';
  if (lower === 'localdate' || lower === 'date') return 'LocalDate';
  if (lower === 'localdatetime' || lower === 'timestamp') return 'LocalDateTime';
  if (lower === 'byte[]') return 'byte[]';

  return trimmed;
}
