import { JavaClassMeta, toSnakeCase } from '../template-models';

export function renderFlutterRemoteDataSource(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const endpointName = `${snake}Endpoint`;

  return `import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/${snake}_model.dart';
import '../models/${snake}_request_model.dart';

abstract class ${meta.className}RemoteDataSource {
  Future<List<${meta.className}Model>> getAll();
  Future<${meta.className}Model> getById(String id);
  Future<${meta.className}Model> create(${meta.className}RequestModel request);
  Future<${meta.className}Model> update(String id, ${meta.className}RequestModel request);
  Future<void> delete(String id);
}

class ${meta.className}RemoteDataSourceImpl implements ${meta.className}RemoteDataSource {
  final ApiClient apiClient;

  const ${meta.className}RemoteDataSourceImpl({required this.apiClient});

  @override
  Future<List<${meta.className}Model>> getAll() async {
    final response = await apiClient.get(ApiConstants.${endpointName});
    if (response.data is List) {
      return (response.data as List)
          .map((item) => ${meta.className}Model.fromJson(item as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Future<${meta.className}Model> getById(String id) async {
    final response = await apiClient.get('\${ApiConstants.${endpointName}}/\$id');
    return ${meta.className}Model.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<${meta.className}Model> create(${meta.className}RequestModel request) async {
    final response = await apiClient.post(
      ApiConstants.${endpointName},
      data: request.toJson(),
    );
    return ${meta.className}Model.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<${meta.className}Model> update(String id, ${meta.className}RequestModel request) async {
    final response = await apiClient.put(
      '\${ApiConstants.${endpointName}}/\$id',
      data: request.toJson(),
    );
    return ${meta.className}Model.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> delete(String id) async {
    await apiClient.delete('\${ApiConstants.${endpointName}}/\$id');
  }
}
`;
}
