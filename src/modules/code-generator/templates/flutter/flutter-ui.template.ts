import { JavaClassMeta, toSnakeCase } from '../template-models';
import { getDartFields, getPluralName } from './flutter-models';

export function renderFlutterCardWidget(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const dartFields = getDartFields(meta);
  const titleField = dartFields.find((f) => !f.isId && f.isString) || dartFields[0];
  const subtitleField = dartFields.find((f) => !f.isId && f !== titleField) || dartFields[1];

  return `import 'package:flutter/material.dart';
import '../../domain/entities/${snake}_entity.dart';

class ${meta.className}CardWidget extends StatelessWidget {
  final ${meta.className}Entity item;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const ${meta.className}CardWidget({
    super.key,
    required this.item,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final title = item.${titleField.name}${titleField.isNullable ? ' ?? ""' : ''};
    ${subtitleField ? `final subtitle = item.${subtitleField.name}${subtitleField.isNullable ? ' != null ? item.' + subtitleField.name + '.toString() : ""' : '.toString()'};` : `final subtitle = "";`}

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.12),
          foregroundColor: Theme.of(context).colorScheme.primary,
          child: Text(
            title.isNotEmpty ? title[0].toUpperCase() : '#',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(
          title.isNotEmpty ? title : 'ID: \${item.${dartFields.find((f) => f.isId)?.name || 'id'}}',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: subtitle.isNotEmpty ? Text(subtitle) : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: Colors.blueGrey),
              onPressed: onEdit,
              tooltip: 'Editar',
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
              onPressed: onDelete,
              tooltip: 'Eliminar',
            ),
          ],
        ),
      ),
    );
  }
}
`;
}

export function renderFlutterListPage(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const classPlural = getPluralName(meta.className);
  const snakePlural = getPluralName(snake);
  const dartFields = getDartFields(meta);
  const idField = dartFields.find((f) => f.isId) || dartFields[0];

  return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/${snake}_bloc.dart';
import '../bloc/${snake}_event.dart';
import '../bloc/${snake}_state.dart';
import '../widgets/${snake}_card_widget.dart';
import '${snake}_form_page.dart';

class ${meta.className}ListPage extends StatefulWidget {
  const ${meta.className}ListPage({super.key});

  @override
  State<${meta.className}ListPage> createState() => _${meta.className}ListPageState();
}

class _${meta.className}ListPageState extends State<${meta.className}ListPage> {
  @override
  void initState() {
    super.initState();
    context.read<${meta.className}Bloc>().add(const Load${classPlural}Event());
  }

  void _confirmDelete(BuildContext context, String id) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Confirmar Eliminación'),
        content: const Text('¿Estás seguro de que deseas eliminar este registro?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () {
              Navigator.pop(dialogCtx);
              context.read<${meta.className}Bloc>().add(Delete${meta.className}Event(id));
            },
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${classPlural}'),
      ),
      body: BlocConsumer<${meta.className}Bloc, ${meta.className}State>(
        listener: (context, state) {
          if (state is ${meta.className}OperationSuccessState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.green),
            );
          } else if (state is ${meta.className}ErrorState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.redAccent),
            );
          }
        },
        builder: (context, state) {
          if (state is ${meta.className}LoadingState) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state is ${classPlural}LoadedState) {
            final items = state.${toCamelCase(classPlural)};
            if (items.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.inbox_outlined, size: 64, color: Colors.grey[400]),
                    const SizedBox(height: 12),
                    Text(
                      'No hay ${toCamelCase(classPlural)} registrados.',
                      style: TextStyle(color: Colors.grey[600], fontSize: 16),
                    ),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: () async {
                context.read<${meta.className}Bloc>().add(const Load${classPlural}Event());
              },
              child: ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final item = items[index];
                  return ${meta.className}CardWidget(
                    item: item,
                    onEdit: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ${meta.className}FormPage(initialItem: item),
                        ),
                      );
                    },
                    onDelete: () => _confirmDelete(context, item.${idField.name}.toString()),
                  );
                },
              ),
            );
          }

          return Center(
            child: ElevatedButton.icon(
              icon: const Icon(Icons.refresh),
              label: const Text('Cargar de nuevo'),
              onPressed: () {
                context.read<${meta.className}Bloc>().add(const Load${classPlural}Event());
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Nuevo'),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const ${meta.className}FormPage(),
            ),
          );
        },
      ),
    );
  }
}
`;
}

export function renderFlutterFormPage(meta: JavaClassMeta): string {
  const snake = toSnakeCase(meta.className);
  const dartFields = getDartFields(meta);
  const editableFields = dartFields.filter((f) => !f.isId);
  const idField = dartFields.find((f) => f.isId) || dartFields[0];

  const controllersDef = editableFields
    .map((f) => `  final _${f.name}Controller = TextEditingController();`)
    .join('\n');

  const populateControllers = editableFields
    .map((f) => {
      if (f.isDateTime) {
        return `      _${f.name}Controller.text = widget.initialItem!.${f.name}${f.isNullable ? '?' : ''}.toIso8601String() ?? '';`;
      }
      return `      _${f.name}Controller.text = widget.initialItem!.${f.name}${f.isNullable ? '?' : ''}.toString() ?? '';`;
    })
    .join('\n');

  const disposeControllers = editableFields
    .map((f) => `    _${f.name}Controller.dispose();`)
    .join('\n');

  const entityInstanceFields = dartFields
    .map((f) => {
      if (f.isId) {
        return `        ${f.name}: isEditing ? widget.initialItem!.${f.name} : ${f.dartType === 'int' ? '0' : "''"},`;
      }
      if (f.isDateTime) {
        return `        ${f.name}: _${f.name}Controller.text.isNotEmpty ? DateTime.tryParse(_${f.name}Controller.text) : ${f.isNullable ? 'null' : 'DateTime.now()'},`;
      }
      if (f.dartType === 'int') {
        return `        ${f.name}: int.tryParse(_${f.name}Controller.text) ?? 0,`;
      }
      if (f.dartType === 'double') {
        return `        ${f.name}: double.tryParse(_${f.name}Controller.text) ?? 0.0,`;
      }
      if (f.dartType === 'bool') {
        return `        ${f.name}: _${f.name}Controller.text.toLowerCase() == 'true',`;
      }
      return `        ${f.name}: _${f.name}Controller.text.trim(),`;
    })
    .join('\n');

  const formFieldsWidgets = editableFields
    .map((f) => {
      const label = f.name.charAt(0).toUpperCase() + f.name.slice(1);
      return `            TextFormField(
              controller: _${f.name}Controller,
              decoration: const InputDecoration(
                labelText: '${label}',
                hintText: 'Ingrese ${label.toLowerCase()}',
              ),
              keyboardType: ${f.isNumber ? 'TextInputType.number' : (f.isDateTime ? 'TextInputType.datetime' : 'TextInputType.text')},
              validator: (val) {
                ${!f.isNullable ? `if (val == null || val.trim().isEmpty) return 'El campo ${label} es requerido';` : ''}
                return null;
              },
            ),
            const SizedBox(height: 16),`;
    })
    .join('\n');

  return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/${snake}_entity.dart';
import '../bloc/${snake}_bloc.dart';
import '../bloc/${snake}_event.dart';
import '../bloc/${snake}_state.dart';

class ${meta.className}FormPage extends StatefulWidget {
  final ${meta.className}Entity? initialItem;

  const ${meta.className}FormPage({super.key, this.initialItem});

  @override
  State<${meta.className}FormPage> createState() => _${meta.className}FormPageState();
}

class _${meta.className}FormPageState extends State<${meta.className}FormPage> {
  final _formKey = GlobalKey<FormState>();
${controllersDef}

  bool get isEditing => widget.initialItem != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
${populateControllers}
    }
  }

  @override
  void dispose() {
${disposeControllers}
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final entity = ${meta.className}Entity(
${entityInstanceFields}
    );

    if (isEditing) {
      context.read<${meta.className}Bloc>().add(
            Update${meta.className}Event(
              id: widget.initialItem!.${idField.name}.toString(),
              entity: entity,
            ),
          );
    } else {
      context.read<${meta.className}Bloc>().add(Create${meta.className}Event(entity));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Editar ${meta.className}' : 'Nuevo ${meta.className}'),
      ),
      body: BlocListener<${meta.className}Bloc, ${meta.className}State>(
        listener: (context, state) {
          if (state is ${meta.className}OperationSuccessState) {
            Navigator.pop(context);
          }
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
${formFieldsWidgets}
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  icon: const Icon(Icons.save),
                  label: Text(isEditing ? 'Actualizar' : 'Guardar'),
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}
