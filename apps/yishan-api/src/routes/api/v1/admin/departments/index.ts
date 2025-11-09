import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { DeptErrorCode } from "../../../../../constants/business-codes/dept.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { DeptListQuery, CreateDeptReq, UpdateDeptReq } from "../../../../../schemas/department.js";
import { DeptService } from "../../../../../services/dept.service.js";

const adminDepts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/admin/departments - 获取部门列表
  fastify.get(
    "/",
    {
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
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        "获取部门列表成功"
      );
    }
  );

  // GET /api/v1/admin/departments/{id} - 获取部门详情
  fastify.get(
    "/:id",
    {
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
      return ResponseUtil.success(reply, dept, "获取部门详情成功");
    }
  );

  // POST /api/v1/admin/departments - 创建部门
  fastify.post(
    "/",
    {
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
      return ResponseUtil.success(reply, dept, "创建部门成功");
    }
  );

  // PUT /api/v1/admin/departments/{id} - 更新部门
  fastify.put(
    "/:id",
    {
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
      return ResponseUtil.success(reply, dept, "更新部门成功");
    }
  );

  // DELETE /api/v1/admin/departments/{id} - 删除部门（软删除）
  fastify.delete(
    "/:id",
    {
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
      return ResponseUtil.success(reply, result, "删除部门成功");
    }
  );

  // GET /api/v1/admin/departments/tree - 获取部门树形结构
  fastify.get(
    "/tree",
    {
      schema: {
        summary: "获取部门树",
        description: "返回部门树形结构（按 sort_order 排序）",
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
      return ResponseUtil.success(reply, tree, "获取部门树成功");
    }
  );
};

export default adminDepts;