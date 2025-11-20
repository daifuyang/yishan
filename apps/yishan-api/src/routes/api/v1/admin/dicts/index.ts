import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import {
  DictDataListQuery,
  DictTypeListQuery,
  SaveDictDataReq,
  SaveDictTypeReq,
  UpdateDictDataReq,
  UpdateDictTypeReq,
} from "../../../../../schemas/dict.js";
import { DictService } from "../../../../../services/dict.service.js";
import { getDictMessage, DictMessageKeys } from "../../../../../constants/messages/dict.js";

const adminDicts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/types",
    {
      schema: {
        summary: "获取字典类型列表",
        description: "分页获取字典类型列表",
        operationId: "getDictTypeList",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "dictTypeListQuery#" },
        response: { 200: { $ref: "dictTypeListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: DictTypeListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await DictService.getDictTypeList(request.query);
      const message = getDictMessage(DictMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/types/:id",
    {
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
      if (!d) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "字典类型不存在");
      const message = getDictMessage(DictMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  fastify.post(
    "/types",
    {
      schema: {
        summary: "创建字典类型",
        description: "创建字典类型",
        operationId: "createDictType",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveDictTypeReq#" },
        response: { 200: { $ref: "dictTypeDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: SaveDictTypeReq }>, reply: FastifyReply) => {
      const d = await DictService.createDictType(request.body, fastify);
      const message = getDictMessage(DictMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  fastify.put(
    "/types/:id",
    {
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
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdateDictTypeReq }>, reply: FastifyReply) => {
      const id = request.params.id;
      const d = await DictService.updateDictType(id, request.body, fastify);
      const message = getDictMessage(DictMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  fastify.delete(
    "/types/:id",
    {
      schema: {
        summary: "删除字典类型",
        description: "软删除字典类型",
        operationId: "deleteDictType",
        tags: ["sysDictTypes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "dictTypeDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const id = request.params.id;
      const res = await DictService.deleteDictType(id, fastify);
      const message = getDictMessage(DictMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, res, message);
    }
  );

  fastify.get(
    "/data",
    {
      schema: {
        summary: "获取字典数据列表",
        description: "分页获取字典数据列表",
        operationId: "getDictDataList",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "dictDataListQuery#" },
        response: { 200: { $ref: "dictDataListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: DictDataListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await DictService.getDictDataList(request.query);
      const message = getDictMessage(DictMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/data/:id",
    {
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
      if (!d) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "字典数据不存在");
      const message = getDictMessage(DictMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  fastify.post(
    "/data",
    {
      schema: {
        summary: "创建字典数据",
        description: "创建字典数据",
        operationId: "createDictData",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveDictDataReq#" },
        response: { 200: { $ref: "dictDataDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: SaveDictDataReq }>, reply: FastifyReply) => {
      const d = await DictService.createDictData(request.body, fastify);
      const message = getDictMessage(DictMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  fastify.put(
    "/data/:id",
    {
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
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdateDictDataReq }>, reply: FastifyReply) => {
      const id = request.params.id;
      const d = await DictService.updateDictData(id, request.body, fastify);
      const message = getDictMessage(DictMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, d, message);
    }
  );

  fastify.delete(
    "/data/:id",
    {
      schema: {
        summary: "删除字典数据",
        description: "软删除字典数据",
        operationId: "deleteDictData",
        tags: ["sysDictData"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "dictDataDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const id = request.params.id;
      const res = await DictService.deleteDictData(id, fastify);
      const message = getDictMessage(DictMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, res, message);
    }
  );

  fastify.get(
    "/data/map",
    {
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