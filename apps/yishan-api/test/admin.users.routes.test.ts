import Fastify from "fastify";
import adminUsersPlugin from "../src/routes/api/v1/admin/users/index.ts";
import registerUserSchemas from "../src/schemas/user.ts";
import registerCommonSchemas from "../src/schemas/common.ts";
import errorHandlerPlugin from "../src/plugins/external/error-handler.ts";
import { UserService } from "../src/services/user.service.ts";
import { ValidationErrorCode } from "../src/constants/business-codes/validation.ts";
import { UserErrorCode } from "../src/constants/business-codes/user.ts";
import { BusinessError } from "../src/exceptions/business-error.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaManager } from "../src/utils/prisma.js";
import { SysUserModel } from "../src/models/sys-user.model.ts";

async function buildApp() {
  const app = Fastify({ logger: false });
  // 注入轻量鉴权装饰器，模拟公共鉴权插件的行为
  app.decorate("authenticate", async (request: any) => {
    const auth = request.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      // 抛出带有statusCode的FastifyError，这样全局错误处理器能正确返回401
      const error = new Error("Unauthorized") as any;
      error.statusCode = 401;
      throw error;
    }
    request.currentUser = {
      id: 1,
      username: "admin",
      email: "admin@example.com",
      realName: "Admin",
      gender: 1,
      genderName: "男",
      status: 1,
      statusName: "启用",
      loginCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginTime: new Date().toISOString(),
    };
  });
  
  // 添加认证钩子 - 模拟autohooks的行为
  app.addHook('preHandler', async (request, reply) => {
    // 检查路由是否需要认证
    const url = request.url;
    if (url.startsWith('/api/v1/admin/')) {
      return (app as any).authenticate(request, reply);
    }
  });
  
  await app.register(errorHandlerPlugin);
  // 先注册通用Schema（包含paginationResponse），否则响应schema校验会失败
  registerCommonSchemas(app);
  registerUserSchemas(app);
  // 注册admin users路由时指定正确的路径前缀
  await app.register(adminUsersPlugin, { prefix: "/api/v1/admin/users" });
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
  
  // Mock Prisma客户端 - 添加更多需要的字段
  const mockPrisma = {
    sysUser: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    sysUserDept: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    sysUserRole: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  
  // Mock prismaManager.getClient() 返回模拟的Prisma客户端
  vi.spyOn(prismaManager, 'getClient').mockReturnValue(mockPrisma as any);
  
  // Mock SysUserModel中的静态prisma属性 - 直接修改私有属性
  (SysUserModel as any).prisma = mockPrisma;
  
  // Mock prismaManager的连接状态
  vi.spyOn(prismaManager, 'getConnectionStatus').mockReturnValue({
    connected: true,
    stats: { queryCount: 0, uptime: 0 }
  });
});

describe("Admin Users routes", () => {
  it("GET /api/v1/admin/users 应返回分页的用户列表", async () => {
    const app = await buildApp();

    const now = new Date().toISOString();
    const list = [
      {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        phone: "13800138000",
        realName: "管理员",
        nickname: "系统管理员",
        gender: 1,
        genderName: "男",
        status: 1,
        statusName: "启用",
        loginCount: 10,
        lastLoginTime: now,
        lastLoginIp: "127.0.0.1",
        creatorId: 1,
        creatorName: "system",
        createdAt: now,
        updaterId: 1,
        updaterName: "system",
        updatedAt: now,
        deptIds: [1],
        roleIds: [1],
      },
    ] as any;

    vi.spyOn(UserService, "getUserList").mockResolvedValue({
      list,
      total: 1,
      page: 1,
      pageSize: 10,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users?page=1&pageSize=10&keyword=admin&status=1&sortBy=createdAt&sortOrder=desc",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0]).toMatchObject({ id: 1, username: "admin" });
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);
    expect(body.pagination.total).toBe(1);

    await app.close();
  });

  it("GET /api/v1/admin/users 未授权访问应返回401错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users?page=1&pageSize=10",
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);

    await app.close();
  });

  it("GET /api/v1/admin/users/:id 成功获取用户详情", async () => {
    const app = await buildApp();

    const now = new Date().toISOString();
    const userDetail = {
      id: 1,
      username: "admin",
      email: "admin@example.com",
      phone: "13800138000",
      realName: "管理员",
      nickname: "系统管理员",
      gender: 1,
      genderName: "男",
      status: 1,
      statusName: "启用",
      loginCount: 10,
      lastLoginTime: now,
      lastLoginIp: "127.0.0.1",
      creatorId: 1,
      creatorName: "system",
      createdAt: now,
      updaterId: 1,
      updaterName: "system",
      updatedAt: now,
      deptIds: [1],
      roleIds: [1],
    } as any;

    vi.spyOn(UserService, "getUserById").mockResolvedValue(userDetail);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users/1",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 1, username: "admin" });

    await app.close();
  });

  it("GET /api/v1/admin/users/:id 用户不存在应返回业务错误", async () => {
    const app = await buildApp();

    vi.spyOn(UserService, "getUserById").mockResolvedValue(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users/999",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(UserErrorCode.USER_NOT_FOUND);

    await app.close();
  });

  it("GET /api/v1/admin/users/:id 非法ID应返回400验证错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users/abc",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER);

    await app.close();
  });

  it("POST /api/v1/admin/users 成功创建用户", async () => {
    const app = await buildApp();

    const now = new Date().toISOString();
    const createdUser = {
      id: 100,
      username: "testuser",
      email: "test@example.com",
      phone: "13800138001",
      realName: "测试用户",
      nickname: "测试员",
      gender: 1,
      genderName: "男",
      status: 1,
      statusName: "启用",
      loginCount: 0,
      creatorId: 1,
      creatorName: "admin",
      createdAt: now,
      updaterId: 1,
      updaterName: "admin",
      updatedAt: now,
      deptIds: [1],
      roleIds: [2],
    } as any;

    vi.spyOn(UserService, "createUser").mockResolvedValue(createdUser);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        username: "testuser",
        email: "test@example.com",
        password: "Password123",
        phone: "13800138001",
        realName: "测试用户",
        nickname: "测试员",
        gender: 1,
        status: 1,
        deptIds: [1],
        roleIds: [2],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 100, username: "testuser" });

    await app.close();
  });

  it("POST /api/v1/admin/users 用户名已存在应返回业务错误", async () => {
    const app = await buildApp();

    vi.spyOn(UserService, "createUser").mockRejectedValue(
      new BusinessError(UserErrorCode.USER_ALREADY_EXISTS, "用户名已存在")
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        username: "admin",
        email: "admin@example.com",
        password: "Password123",
        phone: "13800138000",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(UserErrorCode.USER_ALREADY_EXISTS);

    await app.close();
  });

  it("POST /api/v1/admin/users 密码强度不足应返回验证错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        username: "testuser",
        email: "test@example.com",
        password: "123", // 密码太短，不符合验证规则
        phone: "13800138001",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER);

    await app.close();
  });

  it("PUT /api/v1/admin/users/:id 成功更新用户", async () => {
    const app = await buildApp();

    const now = new Date().toISOString();
    const updatedUser = {
      id: 1,
      username: "admin",
      email: "admin@example.com",
      phone: "13800138000",
      realName: "超级管理员",
      nickname: "系统管理员",
      gender: 1,
      genderName: "男",
      status: 1,
      statusName: "启用",
      loginCount: 10,
      lastLoginTime: now,
      lastLoginIp: "127.0.0.1",
      creatorId: 1,
      creatorName: "system",
      createdAt: now,
      updaterId: 1,
      updaterName: "admin",
      updatedAt: now,
      deptIds: [1],
      roleIds: [1],
    } as any;

    vi.spyOn(UserService, "updateUser").mockResolvedValue(updatedUser);

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/users/1",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        realName: "超级管理员",
        nickname: "系统管理员",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 1, realName: "超级管理员" });

    await app.close();
  });

  it("PUT /api/v1/admin/users/:id 尝试禁用当前登录用户应返回业务错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/users/1",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        status: 0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(UserErrorCode.USER_STATUS_ERROR);

    await app.close();
  });

  it("PUT /api/v1/admin/users/:id 尝试禁用超级管理员应返回业务错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/users/1",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        status: 0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(UserErrorCode.USER_STATUS_ERROR);

    await app.close();
  });

  it("DELETE /api/v1/admin/users/:id 成功删除用户", async () => {
    const app = await buildApp();

    vi.spyOn(UserService, "deleteUser").mockResolvedValue({
      id: 2,
      deleted: true,
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/users/2",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 2, deleted: true });

    await app.close();
  });

  it("DELETE /api/v1/admin/users/:id 尝试删除当前登录用户应返回业务错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/users/1",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(UserErrorCode.USER_STATUS_ERROR);

    await app.close();
  });

  it("DELETE /api/v1/admin/users/:id 尝试删除超级管理员应返回业务错误", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/users/1",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(UserErrorCode.USER_STATUS_ERROR);

    await app.close();
  });
});
