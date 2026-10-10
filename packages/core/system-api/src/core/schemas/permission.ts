import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { successResponse } from './common.js';

const PermissionCatalogItemSchema = Type.Object({
  code: Type.String({ description: '权限码' }),
  label: Type.String({ description: '面向管理员的功能名称' }),
  description: Type.Optional(Type.String({ description: '功能说明' })),
  group: Type.String({ description: '权限分组' }),
  source: Type.String({ description: '来源：core 或插件 ID' }),
}, { $id: 'permissionCatalogItem' });

const PermissionCatalogRespSchema = successResponse({
  data: Type.Array(Type.Ref('permissionCatalogItem')),
  $id: 'permissionCatalogResp',
});

export default function registerPermission(fastify: FastifyInstance) {
  fastify.addSchema(PermissionCatalogItemSchema);
  fastify.addSchema(PermissionCatalogRespSchema);
}
