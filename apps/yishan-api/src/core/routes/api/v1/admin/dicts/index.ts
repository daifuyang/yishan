import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { createCrudHandlers } from '@/core/routes/admin-crud.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "@/utils/response.js";
import { DictErrorCode } from "@/constants/business-codes/dict.js";
import { BusinessError } from "@/exceptions/business-error.js";
import {
  DictDataListQuery,
  DictTypeListQuery,
  SaveDictDataReq,
  SaveDictTypeReq,
  UpdateDictDataReq,
  UpdateDictTypeReq,
} from "@/core/schemas/dict.js";
import { DictService } from "@/core/services/dict.service.js";
import { getDictMessage, DictMessageKeys } from "@/constants/messages/dict.js";
const adminDicts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  const crud = createCrudHandlers(route, {
    resource: 'dict',
    group: 'system',
    perms: {
      list: '字典管理-列表',
      create: '字典管理-创建',
      update: '字典管理-更新',
      delete: '字典管理-删除',
    },
    messages: {
      listSuccess: (lang) => getDictMessage(DictMessageKeys.LIST_SUCCESS, lang),
      createSuccess: (lang) => getDictMessage(DictMessageKeys.CREATE_SUCCESS, lang),
      updateSuccess: (lang) => getDictMessage(DictMessageKeys.UPDATE_SUCCESS, lang),
      deleteSuccess: (lang) => getDictMessage(DictMessageKeys.DELETE_SUCCESS, lang),
    },
  });
  crud.list({
    path: '/types',
    schema: {
      summary: "获取字典类型列表",
      description: "分页获取字典类型列表",
      operationId: "getDictTypeList",
      tags: ["sysDictTypes"],
      security: [{ bearerAuth: [] }],
      querystring: { $ref: "dictTypeListQuery#" },
      response: { 200: { $ref: "dictTypeListResp#" } },
    },
    service: (query) => DictService.getDictTypeList(query as DictTypeListQuery),
  });

  route.get(
    "/types/:id",
    {
      access: { permission: crud.permissions.list },
      schema: {
        summary: "获取字典类型详情",
        description: "根据字典类型ID获取详情",
        operationId: "getDictTypeDetail",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "dictTypeDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const id = request.params.id;
      const d = await DictService.getDictTypeById(id);
      if (!d) throw new BusinessError(DictErrorCode.DICT_TYPE_NOT_FOUND, "字典类型不存在");
      const message = getDictMessage(DictMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  crud.create({
    path: '/types',
    schema: {
        summary: "创建字典类型",
        description: "创建字典类型",
        operationId: "createDictType",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveDictTypeReq#" },
        response: { 200: { $ref: "dictTypeDetailResp#" } },
    },
    service: (request) => DictService.createDictType(request.body as SaveDictTypeReq, fastify),
  });

  crud.update({
    path: '/types/:id',
    schema: {
        summary: "更新字典类型",
        description: "更新字典类型",
        operationId: "updateDictType",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "updateDictTypeReq#" },
        response: { 200: { $ref: "dictTypeDetailResp#" } },
    },
    service: (id, request) => DictService.updateDictType(id, request.body as UpdateDictTypeReq, fastify),
  });

  crud.delete({
    path: '/types/:id',
    schema: {
        summary: "删除字典类型",
        description: "软删除字典类型",
        operationId: "deleteDictType",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "dictTypeDeleteResp#" } },
    },
    service: (id) => DictService.deleteDictType(id, fastify),
  });

  crud.list({
    path: '/data',
    schema: {
        summary: "获取字典数据列表",
        description: "分页获取字典数据列表",
        operationId: "getDictDataList",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "dictDataListQuery#" },
        response: { 200: { $ref: "dictDataListResp#" } },
    },
    service: (query) => DictService.getDictDataList(query as DictDataListQuery),
  });

  route.get(
    "/data/:id",
    {
      access: { permission: crud.permissions.list },
      schema: {
        summary: "获取字典数据详情",
        description: "根据字典数据ID获取详情",
        operationId: "getDictDataDetail",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "dictDataDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const id = request.params.id;
      const d = await DictService.getDictDataById(id);
      if (!d) throw new BusinessError(DictErrorCode.DICT_DATA_NOT_FOUND, "字典数据不存在");
      const message = getDictMessage(DictMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  crud.create({
    path: '/data',
    schema: {
        summary: "创建字典数据",
        description: "创建字典数据",
        operationId: "createDictData",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveDictDataReq#" },
        response: { 200: { $ref: "dictDataDetailResp#" } },
    },
    service: (request) => DictService.createDictData(request.body as SaveDictDataReq, fastify),
  });

  crud.update({
    path: '/data/:id',
    schema: {
        summary: "更新字典数据",
        description: "更新字典数据",
        operationId: "updateDictData",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "updateDictDataReq#" },
        response: { 200: { $ref: "dictDataDetailResp#" } },
    },
    service: (id, request) => DictService.updateDictData(id, request.body as UpdateDictDataReq, fastify),
  });

  crud.delete({
    path: '/data/:id',
    schema: {
        summary: "删除字典数据",
        description: "软删除字典数据",
        operationId: "deleteDictData",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "dictDataDeleteResp#" } },
    },
    service: (id) => DictService.deleteDictData(id, fastify),
  });

  route.get(
    "/data/map",
    {
      access: { permission: crud.permissions.list },
      schema: {
        summary: "获取全部字典数据映射",
        description: "获取所有启用的字典数据，按字典类型分组，返回key:{label:'',value:''}的形式",
        operationId: "getDictDataMap",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "dictDataMapResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await DictService.getAllDictDataMap(fastify);
      const message = getDictMessage(DictMessageKeys.MAP_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default adminDicts;
