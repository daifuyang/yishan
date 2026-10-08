import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { createCrudHandlers, declareCrudPermissions } from '@/core/routes/admin-crud.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ResponseUtil } from '@/utils/response.js';
import { DeptErrorCode } from '@/constants/business-codes/dept.js';
import { BusinessError } from '@/exceptions/business-error.js';
import { DeptListQuery, CreateDeptReq, UpdateDeptReq } from '@/core/schemas/department.js';
import { DeptService } from '@/core/services/dept.service.js';
import { getDepartmentMessage, DepartmentMessageKeys } from '@/constants/messages/department.js';

const CRUD_OPTIONS = {
    resource: 'department',
    group: 'system',
    perms: {
      list: '部门管理-列表',
      create: '部门管理-创建',
      update: '部门管理-更新',
      delete: '部门管理-删除',
    },
    messages: {
      listSuccess: (lang) => getDepartmentMessage(DepartmentMessageKeys.LIST_SUCCESS, lang),
      createSuccess: (lang) => getDepartmentMessage(DepartmentMessageKeys.CREATE_SUCCESS, lang),
      updateSuccess: (lang) => getDepartmentMessage(DepartmentMessageKeys.UPDATE_SUCCESS, lang),
      deleteSuccess: (lang) => getDepartmentMessage(DepartmentMessageKeys.DELETE_SUCCESS, lang),
    },
};
const CRUD_PERMISSIONS = declareCrudPermissions(CRUD_OPTIONS.resource, CRUD_OPTIONS.group, CRUD_OPTIONS.perms);

const adminDepts: FastifyPluginAsync = async (fastify): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  const crud = createCrudHandlers(route, { ...CRUD_OPTIONS, predeclaredPermissions: CRUD_PERMISSIONS });

  crud.list({
    schema: {
      summary: '获取部门列表',
      description: '分页获取部门列表，支持关键词、状态、上级部门过滤',
      operationId: 'getDeptList',
      tags: ['sysDepts'],
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'deptListQuery#' },
      response: { 200: { $ref: 'deptListResp#' } },
    },
    service: (query) => DeptService.getDeptList(query as DeptListQuery),
  });

  route.get('/:id', {
    access: { permission: crud.permissions.list },
    schema: {
      summary: '获取部门详情',
      description: '根据部门ID获取部门详情',
      operationId: 'getDeptDetail',
      tags: ['sysDepts'],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.Integer({ description: '部门ID', minimum: 1 }) }),
      response: { 200: { $ref: 'deptDetailResp#' } },
    },
  }, async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
    const dept = await DeptService.getDeptById(request.params.id);
    if (!dept) {
      throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, '部门不存在');
    }
    const message = getDepartmentMessage(
      DepartmentMessageKeys.DETAIL_SUCCESS,
      request.headers['accept-language'] as string | undefined,
    );
    return ResponseUtil.success(reply, dept, message);
  });

  crud.create({
    schema: {
      summary: '创建部门',
      description: '创建一个新的部门',
      operationId: 'createDept',
      tags: ['sysDepts'],
      security: [{ bearerAuth: [] }],
      body: { $ref: 'createDeptReq#' },
      response: { 200: { $ref: 'deptDetailResp#' } },
    },
    service: (request) => DeptService.createDept(request.body as CreateDeptReq),
  });

  crud.update({
    schema: {
      summary: '更新部门',
      description: '根据部门ID更新部门信息',
      operationId: 'updateDept',
      tags: ['sysDepts'],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.Integer({ description: '部门ID', minimum: 1 }) }),
      body: { $ref: 'updateDeptReq#' },
      response: { 200: { $ref: 'deptDetailResp#' } },
    },
    service: (id, request) => DeptService.updateDept(id, request.body as UpdateDeptReq),
  });

  crud.delete({
    schema: {
      summary: '删除部门',
      description: '根据部门ID进行软删除，存在子部门禁止删除',
      operationId: 'deleteDept',
      tags: ['sysDepts'],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.Integer({ description: '部门ID', minimum: 1 }) }),
      response: { 200: { $ref: 'deptDeleteResp#' } },
    },
    service: (id) => DeptService.deleteDept(id),
  });

  route.get('/tree', {
    access: { permission: crud.permissions.list },
    schema: {
      summary: '获取部门树',
      description: '返回部门树形结构（按 sortOrder 排序）',
      operationId: 'getDeptTree',
      tags: ['sysDepts'],
      security: [{ bearerAuth: [] }],
      response: { 200: { $ref: 'deptTreeResp#' } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tree = await DeptService.getDeptTree();
    const message = getDepartmentMessage(
      DepartmentMessageKeys.TREE_SUCCESS,
      request.headers['accept-language'] as string | undefined,
    );
    return ResponseUtil.success(reply, tree, message);
  });
};

export default adminDepts;
