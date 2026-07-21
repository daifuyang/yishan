import { createRouteRegistrar } from '../../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { DeptService } from "../../../../../services/dept.service.js";
import { UserRepository } from "../../../../../repositories/user.repository.js";
import { registerPermissions, type PermissionRef } from '../../../../../permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  DEPT_TREE: { code: 'app:contacts:dept-tree', label: '移动端通讯录-部门树', group: 'app' },
  DEPT_USERS:{ code: 'app:contacts:dept-users',label: '移动端通讯录-部门成员', group: 'app' },
});
registerPermissions(...Object.values(PERMS));

/**
 * 移动端通讯录路由 - /api/v1/app/contacts
 * 复用 DeptService.getDeptTree；部门成员通过 EXISTS 子查询拉取（userDepts 关联）。
 */
const contacts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  // GET /api/v1/app/contacts/depts/tree - 部门树
  route.get(
    "/depts/tree",
    {
      access: { permission: PERMS.DEPT_TREE },
      schema: {
        summary: "获取部门树（移动端）",
        description: "返回全部部门树形结构，供移动端通讯录展示",
        operationId: "appGetDeptTree",
        tags: ["app-contacts"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: { type: "array", items: { type: "object", additionalProperties: true } },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tree = await DeptService.getDeptTree();
      return ResponseUtil.success(reply, tree, "获取部门树成功");
    },
  );

  // GET /api/v1/app/contacts/depts/:id/users - 部门成员
  route.get(
    "/depts/:id/users",
    {
      access: { permission: PERMS.DEPT_USERS },
      schema: {
        summary: "获取部门成员（移动端）",
        description: "根据部门ID返回该部门下的所有启用用户",
        operationId: "appGetDeptUsers",
        tags: ["app-contacts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    realName: { type: "string" },
                    username: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    avatar: { type: "string" },
                    gender: { type: "string" },
                    genderName: { type: "string" },
                  },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const deptId = (request.params as { id: number }).id;
      // EXISTS 子查询：找出至少有一条 sys_user_dept 关联到 deptId 且未删除的用户。
      // 替代旧垫片里被静默丢弃的 `where.userDepts.some`（属于 Bug 2 修复）。
      const users = await UserRepository.findActiveUsersByDeptId(deptId);

      const data = users.map((u) => ({
        id: u.id,
        username: u.username,
        realName: u.realName ?? "",
        phone: u.phone,
        email: u.email ?? "",
        avatar: u.avatar ?? "",
        gender: u.gender.toString(),
        genderName: u.gender === 1 ? "男" : u.gender === 2 ? "女" : "未知",
      }));

      return ResponseUtil.success(reply, data, "获取部门成员成功");
    },
  );
};

export default contacts;