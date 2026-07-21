import { createRouteRegistrar } from '../../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { DeptErrorCode } from "../../../../../../constants/business-codes/dept.js";
import { BusinessError } from "../../../../../../exceptions/business-error.js";
import { DeptListQuery, CreateDeptReq, UpdateDeptReq } from "../../../../../schemas/department.js";
import { DeptService } from "../../../../../services/dept.service.js";
import { getDepartmentMessage, DepartmentMessageKeys } from "../../../../../../constants/messages/department.js";
import { registerPermissions, type PermissionRef } from '../../../../../permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LIST:   { code: 'system:department:list',   label: '部门管理-列表', group: 'system' },
  CREATE: { code: 'system:department:create', label: '部门管理-创建', group: 'system' },
  UPDATE: { code: 'system:department:update', label: '部门管理-更新', group: 'system' },
  DELETE: { code: 'system:department:delete', label: '部门管理-删除', group: 'system' },
});
registerPermissions(...Object.values(PERMS));
const adminDepts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  // GET /api/v1/admin/departments - 获取部门列表
  route.get(
    "/",
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: "获取部门列表",
        description: "分页获取部门列表，支持关键词、状态、上级部门过滤",
        operationId: "getDeptList",
        tags: ["sysDepts"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "deptListQuery#" },
        response: {
          200: { $ref: "deptListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: DeptListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await DeptService.getDeptList(request.query);
      const message = getDepartmentMessage(DepartmentMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        message
      );
    }
  );

  // GET /api/v1/admin/departments/{id} - 获取部门详情
  route.get(
    "/:id",
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: "获取部门详情",
        description: "根据部门ID获取部门详情",
        operationId: "getDeptDetail",
        tags: ["sysDepts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "部门ID", minimum: 1 }) }),
        response: { 200: { $ref: "deptDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const deptId = request.params.id;
      const dept = await DeptService.getDeptById(deptId);
      if (!dept) {
        throw new BusinessError(DeptErrorCode.DEPT_NOT_FOUND, "部门不存在");
      }
      {
        const message = getDepartmentMessage(DepartmentMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, dept, message);
      }
    }
  );

  // POST /api/v1/admin/departments - 创建部门
  route.post(
    "/",
    {
      access: { permission: PERMS.CREATE },
      schema: {
        summary: "创建部门",
        description: "创建一个新的部门",
        operationId: "createDept",
        tags: ["sysDepts"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "createDeptReq#" },
        response: { 200: { $ref: "deptDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateDeptReq }>,
      reply: FastifyReply
    ) => {
      const dept = await DeptService.createDept(request.body);
      {
        const message = getDepartmentMessage(DepartmentMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, dept, message);
      }
    }
  );

  // PUT /api/v1/admin/departments/{id} - 更新部门
  route.put(
    "/:id",
    {
      access: { permission: PERMS.UPDATE },
      schema: {
        summary: "更新部门",
        description: "根据部门ID更新部门信息",
        operationId: "updateDept",
        tags: ["sysDepts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "部门ID", minimum: 1 }) }),
        body: { $ref: "updateDeptReq#" },
        response: { 200: { $ref: "deptDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: UpdateDeptReq }>,
      reply: FastifyReply
    ) => {
      const deptId = request.params.id;
      const dept = await DeptService.updateDept(deptId, request.body);
      {
        const message = getDepartmentMessage(DepartmentMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, dept, message);
      }
    }
  );

  // DELETE /api/v1/admin/departments/{id} - 删除部门（软删除）
  route.delete(
    "/:id",
    {
      access: { permission: PERMS.DELETE },
      schema: {
        summary: "删除部门",
        description: "根据部门ID进行软删除，存在子部门禁止删除",
        operationId: "deleteDept",
        tags: ["sysDepts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "部门ID", minimum: 1 }) }),
        response: { 200: { $ref: "deptDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const deptId = request.params.id;
      const result = await DeptService.deleteDept(deptId);
      {
        const message = getDepartmentMessage(DepartmentMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, result, message);
      }
    }
  );

  // GET /api/v1/admin/departments/tree - 获取部门树形结构
  route.get(
    "/tree",
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: "获取部门树",
        description: "返回部门树形结构（按 sortOrder 排序）",
        operationId: "getDeptTree",
        tags: ["sysDepts"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "deptTreeResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tree = await DeptService.getDeptTree();
      {
        const message = getDepartmentMessage(DepartmentMessageKeys.TREE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, tree, message);
      }
    }
  );
};

export default adminDepts;
