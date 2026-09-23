import { ProjectContext } from './template-models';
import { SeededEntityData } from './fake-data.helper';
import { randomUUID } from 'crypto';

export function renderPostmanCollection(
  context: ProjectContext,
  seededData: SeededEntityData[],
): string {
  const srvPort = context.serverPort || 8080;

  const folders = seededData.map((item) => {
    const { meta, rows, samplePostDto, samplePutDto } = item;
    const endpointPath = meta.endpointPath || meta.tableName.replace(/_/g, '-');
    const firstRowId = rows.length > 0 ? String(rows[0].id) : '1';
    const deleteRowId = rows.length >= 3 ? String(rows[2].id) : firstRowId;

    const items = [
      {
        name: `1. Listar ${meta.className} (GET)`,
        request: {
          method: 'GET',
          header: [
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          url: {
            raw: `{{baseUrl}}/${endpointPath}`,
            host: ['{{baseUrl}}'],
            path: [endpointPath],
          },
          description: `Obtiene todos los registros de ${meta.className}. Incluye los datos sembrados automáticamente por Flyway.`,
        },
      },
      {
        name: `2. Obtener ${meta.className} por ID (GET)`,
        request: {
          method: 'GET',
          header: [
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          url: {
            raw: `{{baseUrl}}/${endpointPath}/:id`,
            host: ['{{baseUrl}}'],
            path: [endpointPath, ':id'],
            variable: [
              {
                key: 'id',
                value: firstRowId,
                description: `ID del primer registro sembrado de ${meta.className}`,
              },
            ],
          },
          description: `Obtiene un registro específico de ${meta.className} por ID (preconfigurado con el ID sembrado).`,
        },
      },
      {
        name: `3. Crear ${meta.className} (POST)`,
        request: {
          method: 'POST',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(samplePostDto, null, 2),
            options: {
              raw: {
                language: 'json',
              },
            },
          },
          url: {
            raw: `{{baseUrl}}/${endpointPath}`,
            host: ['{{baseUrl}}'],
            path: [endpointPath],
          },
          description: `Crea un nuevo registro de ${meta.className} con datos válidos de prueba prellenados.`,
        },
      },
      {
        name: `4. Actualizar ${meta.className} (PUT)`,
        request: {
          method: 'PUT',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify(samplePutDto, null, 2),
            options: {
              raw: {
                language: 'json',
              },
            },
          },
          url: {
            raw: `{{baseUrl}}/${endpointPath}/:id`,
            host: ['{{baseUrl}}'],
            path: [endpointPath, ':id'],
            variable: [
              {
                key: 'id',
                value: firstRowId,
                description: `ID del registro de ${meta.className} a actualizar`,
              },
            ],
          },
          description: `Actualiza el registro con ID prellenado enviando los nuevos datos de prueba.`,
        },
      },
      {
        name: `5. Eliminar ${meta.className} (DELETE)`,
        request: {
          method: 'DELETE',
          header: [
            {
              key: 'Accept',
              value: 'application/json',
            },
          ],
          url: {
            raw: `{{baseUrl}}/${endpointPath}/:id`,
            host: ['{{baseUrl}}'],
            path: [endpointPath, ':id'],
            variable: [
              {
                key: 'id',
                value: deleteRowId,
                description: `ID del registro de prueba a eliminar sin afectar las pruebas 1 y 2`,
              },
            ],
          },
          description: `Elimina un registro de ${meta.className} por su ID.`,
        },
      },
    ];

    return {
      name: meta.className,
      description: `Endpoints REST para operaciones CRUD sobre ${meta.className}`,
      item: items,
    };
  });

  const collection = {
    info: {
      _postman_id: randomUUID ? randomUUID() : '00000000-0000-0000-0000-000000000000',
      name: `${context.projectName} API`,
      description: `Colección de pruebas para ${context.projectName}. Generada automáticamente por UML Collaborative Studio con datos de prueba sembrados y peticiones CRUD listas para ejecutar al instante.`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      {
        key: 'baseUrl',
        value: `http://localhost:${srvPort}/api/v1`,
        type: 'string',
      },
    ],
    item: folders,
  };

  return JSON.stringify(collection, null, 2);
}
