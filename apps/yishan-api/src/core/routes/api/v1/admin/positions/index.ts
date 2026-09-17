import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { createRouteRegistrar } from '../../../../route-registrar.js';
import { createCrudHandlers } from '../../../../admin-crud.js';
import { ResponseUtil } from '../../../../../../utils/response.js';
import { ValidationErrorCode } from '../../../../../../constants/business-codes/validation.js';
import { PositionErrorCode } from '../../../../../../constants/business-codes/position.js';
import { BusinessError } from '../../../../../../exceptions/business-error.js';
import type { PositionListQuery, SavePositionReq, UpdatePositionReq } from '../../../../../schemas/position.js';
import { PositionService } from '../../../../../services/position.service.js';
import { getPositionMessage, PositionMessageKeys } from '../../../../../../constants/messages/position.js';

const adminPositions: FastifyPluginAsync = async (fastify): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  const crud = createCrudHandlers(route, {
    resource: 'position',
    group: 'system',
    perms: {
      list: '岗位管理-列表',
      create: '岗位管理-创建',
      update: '岗位管理-更新',
      delete: '岗位管理-删除',
    },
    messages: {
      listSuccess: (lang) => getPositionMessage(PositionMessageKeys.LIST_SUCCESS, lang),
      createSuccess: (lang) => getPositionMessage(PositionMessageKeys.CREATE_SUCCESS, lang),
      updateSuccess: (lang) => getPositionMessage(PositionMessageKeys.UPDATE_SUCCESS, lang),
      deleteSuccess: (lang) => getPositionMessage(PositionMessageKeys.DELETE_SUCCESS, lang),
    },
  });

  crud.list({
    schema: {
      summary: '获取岗位列表',
      description: '分页获取系统岗位列表，支持关键词搜索和状态筛选',
      operationId: 'getPositionList',
      tags: ['sysPositions'],
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'positionListQuery#' },
      response: { 200: { $ref: 'positionListResp#' } },
    },
    service: (query) => PositionService.getPositionList(query as PositionListQuery),
  });

  // 详情接口不是标准 CRUD 四件套的一部分，因此保留显式处理。
  route.get('/:id', {
    access: { permission: crud.permissions.list },
    schema: {
      summary: '获取岗位详情',
      description: '根据岗位ID获取岗位详情',
      operationId: 'getPositionDetail',
      tags: ['sysPositions'],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ description: '岗位ID' }) }),
      response: { 200: { $ref: 'positionDetailResp#' } },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const positionId = parseInt(request.params.id, 10);
    if (Number.isNaN(positionId)) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, '岗位ID不能为空');
    }
    const position = await PositionService.getPositionById(positionId);
    if (!position) {
      throw new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, '岗位不存在');
    }
    return ResponseUtil.success(
      reply,
      position,
      getPositionMessage(PositionMessageKeys.DETAIL_SUCCESS, request.headers['accept-language'] as string | undefined),
    );
  });

  crud.create({
    schema: {
      summary: '创建岗位',
      description: '创建一个新的岗位',
      operationId: 'createPosition',
      tags: ['sysPositions'],
      security: [{ bearerAuth: [] }],
      body: { $ref: 'savePositionReq#' },
      response: { 200: { $ref: 'positionDetailResp#' } },
    },
    service: (request) => PositionService.createPosition(request.body as SavePositionReq),
  });

  const parsePositionId = (rawId: string) => {
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, '岗位ID不能为空');
    }
    return id;
  };

  crud.update({
    schema: {
      summary: '更新岗位',
      description: '根据岗位ID更新岗位信息',
      operationId: 'updatePosition',
      tags: ['sysPositions'],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ description: '岗位ID' }) }),
      body: { $ref: 'updatePositionReq#' },
      response: { 200: { $ref: 'positionDetailResp#' } },
    },
    parseId: parsePositionId,
    service: (id, request) => PositionService.updatePosition(id, request.body as UpdatePositionReq),
  });

  crud.delete({
    schema: {
      summary: '删除岗位',
      description: '根据岗位ID进行软删除',
      operationId: 'deletePosition',
      tags: ['sysPositions'],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String({ description: '岗位ID' }) }),
      response: { 200: { $ref: 'positionDeleteResp#' } },
    },
    parseId: parsePositionId,
    service: (id) => PositionService.deletePosition(id),
  });
};

export default adminPositions;
