import { createRouteRegistrar } from '../../../../../route-registrar.js';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ResponseUtil } from '../../../../../../../utils/response.js';
import { RegionService } from '../../../../../../services/region.service.js';
import { registerPermissions, type PermissionRef } from '../../../../../../permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LIST: { code: 'region:list', label: '行政区划-列表', group: 'region' },
  TREE: { code: 'region:tree', label: '行政区划-树', group: 'region' },
  PATH: { code: 'region:path', label: '行政区划-路径', group: 'region' },
  READ: { code: 'region:read', label: '行政区划-详情', group: 'region' },
});
registerPermissions(...Object.values(PERMS));

const regionSchema = Type.Object({
  code: Type.Integer(),
  name: Type.String(),
  level: Type.Integer(),
  parentCode: Type.Integer(),
  sortOrder: Type.Integer(),
});

const adminSystemRegions: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.get(
    '/',
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: '地区列表',
        description: '按父级行政区划代码获取下级地区列表',
        operationId: 'listSystemRegions',
        tags: ['systemRegions'],
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          parentCode: Type.Optional(Type.Integer({ default: 0 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Number(),
            message: Type.String(),
            data: Type.Array(regionSchema),
            timestamp: Type.String(),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { parentCode?: number } }>, reply: FastifyReply) => {
      const data = await RegionService.listByParent(request.query.parentCode || 0);
      return ResponseUtil.success(reply, data, '获取地区列表成功');
    }
  );

  route.get(
    '/tree',
    {
      access: { permission: PERMS.TREE },
      schema: {
        summary: '地区树',
        description: '获取省市区三级地区树',
        operationId: 'getSystemRegionTree',
        tags: ['systemRegions'],
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          level: Type.Optional(Type.Integer({ default: 3, minimum: 1, maximum: 3 })),
        }),
      },
    },
    async (request: FastifyRequest<{ Querystring: { level?: number } }>, reply: FastifyReply) => {
      const data = await RegionService.getTree(request.query.level || 3);
      return ResponseUtil.success(reply, data, '获取地区树成功');
    }
  );

  route.get(
    '/path',
    {
      access: { permission: PERMS.PATH },
      schema: {
        summary: '地区路径',
        description: '按行政区划代码获取省市区路径',
        operationId: 'getSystemRegionPath',
        tags: ['systemRegions'],
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          code: Type.Integer(),
        }),
      },
    },
    async (request: FastifyRequest<{ Querystring: { code: number } }>, reply: FastifyReply) => {
      const data = await RegionService.getPath(request.query.code);
      return ResponseUtil.success(reply, data, '获取地区路径成功');
    }
  );

  route.get(
    '/:code',
    {
      access: { permission: PERMS.READ },
      schema: {
        summary: '地区详情',
        description: '按行政区划代码获取地区详情',
        operationId: 'getSystemRegion',
        tags: ['systemRegions'],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          code: Type.Integer(),
        }),
      },
    },
    async (request: FastifyRequest<{ Params: { code: number } }>, reply: FastifyReply) => {
      const data = await RegionService.getRegion(request.params.code);
      return ResponseUtil.success(reply, data, '获取地区详情成功');
    }
  );
};

export default adminSystemRegions;
