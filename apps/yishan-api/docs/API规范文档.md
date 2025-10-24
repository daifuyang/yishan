# Yishan API 规范文档

本文档旨在整理和规范 Yishan 项目的 API 开发标准，包括路由层、服务层、模型层的实现方式，以及 Schema、TypeBox 类型和 Prisma 类型的使用规范。

## 项目结构

```
apps/yishan-api/
├── src/
│   ├── routes/           # 路由层 (API 端点定义)
│   ├── services/         # 服务层 (业务逻辑处理)
│   ├── models/           # 模型层 (数据访问层)
│   ├── schemas/          # TypeBox Schema 定义 (请求/响应验证)
│   ├── constants/        # 常量定义 (错误码、业务码)
│   ├── utils/            # 工具类 (响应工具、数据库连接等)
│   ├── plugins/          # Fastify 插件配置
│   │   ├── external/     # 外部插件 (数据库、认证、Swagger等)
│   │   └── app/          # 应用插件
│   ├── controllers/      # 控制器层 (可选，复杂业务场景)
│   └── generated/        # 自动生成的代码 (Prisma Client)
├── prisma/               # Prisma 配置和迁移文件
└── ...
```

## 1. 路由层规范 (Routes)

路由层负责处理 HTTP 请求和响应，使用 Fastify 框架实现。

### 1.1 路由文件结构

路由文件应按照业务模块组织，采用 RESTful 风格命名。文件路径：`src/routes/api/v1/{模块}/{子模块}/index.ts`

```typescript
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ErrorCode } from "../../../../../constants/business-code.js";
import { UserListQuery, SaveUserReq } from "../../../../../schemas/user.js";
import { UserService } from "../../../../../services/user.service.js";

const sysUser: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/admin/users - 获取用户列表
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取管理员用户列表",
        description: "分页获取系统用户列表，支持关键词搜索和状态筛选",
        operationId: "getUserList",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "userListQuery#" },
        response: {
          200: { $ref: "userListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: UserListQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { page, pageSize } = request.query;

        // 使用UserService获取管理员列表
        const result = await UserService.getUserList(request.query);
        
        return ResponseUtil.sendPaginated(
          reply,
          result.list,
          page,
          pageSize,
          result.total,
          "获取用户列表成功"
        );
      } catch (error: unknown) {
        fastify.log.error(error);
        return ResponseUtil.sendError(
          reply,
          ErrorCode.DATABASE_ERROR,
          "获取用户列表失败"
        );
      }
    }
  );

  // POST /api/v1/admin/users - 创建用户
  fastify.post(
    "/",
    {
      schema: {
        summary: "创建用户",
        description: "创建一个新的系统用户",
        operationId: "createUser",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveUserReq#" },
        response: {
          200: { $ref: "userDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SaveUserReq }>,
      reply: FastifyReply
    ) => {
      try {
        // 使用UserService创建用户
        const user = await UserService.createUser(request.body);
        return ResponseUtil.sendSuccess(reply, user, "创建用户成功");
      } catch (error: any) {
        fastify.log.error(error);
        // 处理业务错误
        if (error.message === `${ErrorCode.USER_ALREADY_EXISTS}`) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.USER_ALREADY_EXISTS,
            "用户已存在"
          );
        }
        return ResponseUtil.sendError(
          reply,
          ErrorCode.DATABASE_ERROR,
          "创建用户失败"
        );
      }
    }
  );

  // PUT /api/v1/admin/users/{id} - 更新用户
  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新用户",
        description: "根据用户ID更新用户信息",
        operationId: "updateUser",
        tags: ["sysUsers"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.String({ description: "用户ID" }),
        }),
        body: { $ref: "saveUserReq#" },
        response: {
          200: { $ref: "sysUser#" },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: SaveUserReq;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = parseInt(request.params.id);
        // 验证用户ID
        if (isNaN(userId)) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.INVALID_PARAMETER,
            "用户ID无效"
          );
        }
        // 使用UserService更新用户
        const user = await UserService.updateUser(userId, request.body);
        return ResponseUtil.sendSuccess(reply, user, "更新用户成功");
      } catch (error: any) {
        fastify.log.error(error);
        // 处理业务错误
        if (error.message === `${ErrorCode.USER_NOT_FOUND}`) {
          return ResponseUtil.sendError(
            reply,
            ErrorCode.USER_NOT_FOUND,
            "用户不存在"
          );
        }
        return ResponseUtil.sendError(
          reply,
          ErrorCode.DATABASE_ERROR,
          "更新用户失败"
        );
      }
    }
  );
};

export default sysUser;
```

### 1.2 路由规范要点

1. **文件命名**：使用 `index.ts` 作为路由文件名，便于模块化组织
2. **导入规范**：
   - 导入必要的 Fastify 类型
   - 导入响应工具类 `ResponseUtil`
   - 导入业务错误码 `ErrorCode`
   - 导入相关 Schema 类型
   - 导入对应的服务层类
3. **路由定义**：
   - 使用 Fastify 的路由方法（get、post、put、delete等）
   - 定义完整的 OpenAPI Schema
   - 使用 TypeBox Schema 引用
   - 正确处理请求和响应类型
   - **路径命名**：使用 RESTful 风格，小写字母，复数形式
     - ✅ 正确：`/users`, `/products`, `/orders`
     - ❌ 错误：`/user`, `/getUsers`, `/User`
   - **HTTP 方法**：
     - `GET`：获取资源（列表或详情）
     - `POST`：创建资源
     - `PUT`：更新资源（全量更新）
     - `PATCH`：更新资源（部分更新）
     - `DELETE`：删除资源
   - **路径参数**：使用 `/users/:id` 格式
   - **查询参数**：使用驼峰命名，如 `pageSize`, `userName`
   - **操作 ID**：使用 `getUserList`、`createUser` 等清晰描述操作
   - **标签分组**：使用统一的标签分组，便于接口文档管理
     - 示例：`tags: ["sysUsers"]` 表示用户管理相关接口
4. **错误处理**：
   - 使用 try/catch 包裹业务逻辑
   - 使用 `ResponseUtil.sendError` 发送错误响应
   - 记录错误日志 `fastify.log.error(error)`

## 2. Schema 层规范

Schema 层使用 TypeBox 定义 TypeScript 类型和 JSON Schema，用于请求验证和 API 文档生成。

### 2.1 Schema 文件结构

```typescript
/**
 * 用户相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 用户基础信息 Schema
export const SysUserSchema = Type.Object(
  {
    id: Type.String({ description: "用户ID" }),
    username: Type.String({ description: "用户名" }),
    email: Type.String({ format: "email", description: "邮箱" }),
    // ... 其他字段
  },
  { $id: "sysUser" }
);

// 用户列表查询参数 Schema
export const UserListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({
        description: "搜索关键词（用户名、邮箱、真实姓名）",
      })
    ),
    // ... 其他查询参数
  },
  { $id: "userListQuery" }
);

export type UserListQuery = Static<typeof UserListQuerySchema>;

export const UserListResponseSchema = successResponse({
  data: Type.Object({
    list: Type.Array(Type.Ref("sysUser")),
    pagination: Type.Ref("paginationResponse"),
  }),
  $id: "userListResponse",
});

export const SaveUserReqSchema = Type.Object(
  {
    username: Type.String({ minLength: 3, maxLength: 50, description: "用户名" }),
    email: Type.String({ format: "email", description: "邮箱地址" }),
    password: Type.String({ minLength: 6, maxLength: 20, description: "密码" }),
    status: Type.Optional(Type.Integer({ description: "状态" })),
  },
  { $id: "saveUserReq" }
);

export type SaveUserReq = Static<typeof SaveUserReqSchema>;

const registerUser = (fastify: FastifyInstance) => {
  fastify.addSchema(SysUserSchema);
  fastify.addSchema(UserListQuerySchema);
  fastify.addSchema(UserListResponseSchema);
  fastify.addSchema(SaveUserReqSchema);
};

export default registerUser;
```

### 2.2 Schema 规范要点

1. **类型定义**：
   - 使用 `Type.Object` 定义对象结构
   - 使用 `Type.String`、`Type.Number` 等定义基本类型
   - 使用 `Type.Optional` 定义可选字段
   - 使用 `Type.Ref` 引用其他 Schema
2. **TypeScript 类型映射**：
   - 使用 `Static<typeof Schema>` 将 TypeBox Schema 映射为 TypeScript 类型
3. **Schema 注册**：
   - 在 `register` 函数中使用 `fastify.addSchema()` 注册 Schema
   - 为 Schema 添加 `$id` 属性以便引用

## 3. 服务层规范 (Services)

服务层负责业务逻辑处理，是路由层和模型层之间的桥梁。

### 3.1 服务文件结构

```typescript
/**
 * 用户业务逻辑服务
 */

import { UserModel } from "../models/user.model.js";
import { UserListQuery } from "../schemas/user.js";
import { BusinessError } from "../utils/errors.js";
import { ErrorCode } from "../constants/business-code.js";

export class UserService {
  /**
   * 获取管理员列表
   * @param query 查询参数
   * @returns 管理员列表和总数
   */
  static async getUserList(query: UserListQuery) {
    // 获取用户列表
    const list = await UserModel.getUserList(query);

    // 获取总数量
    const total = await UserModel.getUserTotal(query);

    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /**
   * 获取单个用户信息
   * @param id 用户ID
   * @returns 用户信息
   */
  static async getUserById(id: number) {
    const user = await UserModel.getUserById(id);
    if (!user) {
      throw new BusinessError(ErrorCode.USER_NOT_FOUND, "用户不存在");
    }
    return user;
  }
}
```

### 3.2 服务规范要点

1. **类结构**：使用 `class` 定义服务类，方法使用 `static` 修饰符
2. **职责分离**：服务层只处理业务逻辑，不直接操作数据库
3. **数据获取**：通过模型层获取数据
4. **数据处理**：在服务层处理业务逻辑，如数据组装、计算等

## 4. 模型层规范 (Models)

模型层负责与数据库交互，使用 Prisma ORM 进行数据操作。

### 4.1 模型类结构

```typescript
/**
 * 用户数据访问模型
 */

import { prismaManager } from "../plugins/external/prisma.js";
import { SysUser, Prisma } from "../generated/prisma/index.js";
import { UserQuery } from "../schemas/user.js";

export class UserModel {
  private prisma = prismaManager.getPrisma();

  // 查询用户列表
  async findUsers(query: UserQuery) {
    const where: Prisma.SysUserWhereInput = {};
    
    // 构建查询条件
    if (query.keyword) {
      where.OR = [
        { username: { contains: query.keyword } },
        { email: { contains: query.keyword } }
      ];
    }
    
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [list, total] = await Promise.all([
      this.prisma.sysUser.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.sysUser.count({ where })
    ]);

    return { list, total };
  }

  // 根据ID查询用户
  async findById(id: number): Promise<SysUser | null> {
    return await this.prisma.sysUser.findUnique({
      where: { id }
    });
  }

  // 根据邮箱查询用户
  async findByEmail(email: string): Promise<SysUser | null> {
    return await this.prisma.sysUser.findUnique({
      where: { email }
    });
  }

  // 创建用户
  async create(data: Prisma.SysUserCreateInput): Promise<SysUser> {
    return await this.prisma.sysUser.create({ data });
  }

  // 更新用户
  async update(id: number, data: Prisma.SysUserUpdateInput): Promise<SysUser> {
    return await this.prisma.sysUser.update({
      where: { id },
      data
    });
  }

  // 删除用户
  async delete(id: number): Promise<SysUser> {
    return await this.prisma.sysUser.delete({
      where: { id }
    });
  }

  // 获取用户总数
  async getUserTotal(where?: Prisma.SysUserWhereInput): Promise<number> {
    return await this.prisma.sysUser.count({ where });
  }

  // 获取用户列表（带分页和过滤）
  async getUserList(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    status?: number;
  }) {
    const where: Prisma.SysUserWhereInput = {};
    
    if (params.keyword) {
      where.OR = [
        { username: { contains: params.keyword } },
        { email: { contains: params.keyword } }
      ];
    }
    
    if (params.status !== undefined) {
      where.status = params.status;
    }

    const [list, total] = await Promise.all([
      this.prisma.sysUser.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.sysUser.count({ where })
    ]);

    return { list, total };
  }

  // 根据ID获取用户信息
  async getUserById(id: number): Promise<SysUser | null> {
    return await this.prisma.sysUser.findUnique({
      where: { id }
    });
  }
}
```

### 4.2 模型规范要点

1. **Prisma 客户端**：通过 `prismaManager` 获取 Prisma 客户端实例
2. **数据操作**：使用 Prisma 提供的方法进行数据库操作
3. **查询构建**：根据业务需求构建查询条件
4. **数据返回**：直接返回 Prisma 查询结果，类型安全

## 9. 数据库规范

### 9.1 Prisma Schema 规范

```prisma
// ============= Prisma Schema 配置 =============
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ============= 模型命名规范 =============
model SysUser {
  id              Int       @id @default(autoincrement()) @map("id")
  username        String    @unique @map("username") @db.VarChar(50)
  email           String    @unique @map("email") @db.VarChar(100)
  phone           String?   @unique @map("phone") @db.VarChar(20)
  passwordHash    String    @map("password_hash") @db.VarChar(255)
  salt            String    @map("salt") @db.VarChar(32)
  realName        String    @map("real_name") @db.VarChar(50)
  avatar          String?   @map("avatar") @db.VarChar(500)
  gender          Int       @default(0) @map("gender") @db.TinyInt
  birthDate       DateTime? @map("birth_date") @db.Date
  status          Int       @default(1) @map("status") @db.TinyInt
  lastLoginTime   DateTime? @map("last_login_time") @db.DateTime(0)
  lastLoginIp     String?   @map("last_login_ip") @db.VarChar(45)
  loginCount      Int       @default(0) @map("login_count")
  creatorId       Int?      @map("creator_id")
  createdAt       DateTime  @default(now()) @map("created_at") @db.DateTime(0)
  updaterId       Int?      @map("updater_id")
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at") @db.DateTime(0)
  deletedAt       DateTime? @map("deleted_at") @db.DateTime(0)
  version         Int       @default(1) @map("version")

  // 自引用关系
  creator         SysUser?  @relation("UserCreator", fields: [creatorId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  createdUsers    SysUser[] @relation("UserCreator")
  updater         SysUser?  @relation("UserUpdater", fields: [updaterId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  updatedUsers    SysUser[] @relation("UserUpdater")

  // 索引定义
  @@index([status], map: "idx_status")
  @@index([createdAt], map: "idx_created_at")
  @@index([deletedAt], map: "idx_deleted_at")
  @@index([creatorId], map: "idx_creator_id")
  @@index([updaterId], map: "idx_updater_id")
  @@index([status, createdAt], map: "idx_status_created")
  @@index([realName, status], map: "idx_real_name_status")
  
  @@map("sys_user")
}
```

### 9.2 Prisma Schema 规范要点

1. **模型命名**: 使用 PascalCase，如 `SysUser`、`SysRole`
2. **字段命名**: 使用 camelCase，数据库字段使用 snake_case
3. **映射规范**: 使用 `@map` 将模型字段映射到数据库字段
4. **索引规范**: 为常用查询字段添加索引
5. **表名映射**: 使用 `@@map` 将模型映射到数据库表名
6. **关系定义**: 明确定义模型间关系，包括自引用关系
7. **字段约束**: 使用 `@unique`、`@default` 等约束
8. **数据类型**: 明确指定数据库字段类型，如 `@db.VarChar(50)`

### 9.3 Prisma 客户端使用规范

```typescript
// src/models/User.ts
import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export class UserModel {
  // 创建用户
  static async createUser(data: Prisma.SysUserCreateInput) {
    return await prisma.sysUser.create({ data });
  }

  // 查询用户列表
  static async getUserList(params: {
    page: number;
    pageSize: number;
    keyword?: string;
  }) {
    const { page, pageSize, keyword } = params;
    const where: Prisma.SysUserWhereInput = {};
    
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } }
      ];
    }

    const [total, list] = await Promise.all([
      prisma.sysUser.count({ where }),
      prisma.sysUser.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      })
    ]);

    return { total, list };
  }

  // 根据ID查询用户
  static async getUserById(id: number) {
    return await prisma.sysUser.findUnique({
      where: { id }
    });
  }

  // 更新用户
  static async updateUser(id: number, data: Prisma.SysUserUpdateInput) {
    return await prisma.sysUser.update({
      where: { id },
      data
    });
  }

  // 删除用户
  static async deleteUser(id: number) {
    return await prisma.sysUser.delete({
      where: { id }
    });
  }
}
```

## 6. 响应规范

系统使用统一的响应格式，通过 `ResponseUtil` 工具类处理。

### 6.1 响应结构

```typescript
// 基础响应格式
export interface BaseResponse<T = any> {
  code: number;      // 业务状态码
  message: string;   // 响应消息
  data: T;          // 响应数据
}

// 分页响应格式
export interface PaginatedResponse<T = any> {
  code: number;      // 业务状态码
  message: string;   // 响应消息
  data: {
    list: T[];      // 数据列表
    total: number;  // 总记录数
    page: number;   // 当前页码
    pageSize: number; // 每页条数
  };
}

// 错误响应格式
export interface ErrorResponse {
  code: number;      // 错误码
  message: string;   // 错误消息
  timestamp: string; // 时间戳
  path?: string;    // 请求路径
}
```

### 6.2 响应工具类

```typescript
import { FastifyReply } from "fastify";
import { ErrorCode } from "../constants/business-code.js";

export class ResponseUtil {
  /**
   * 发送成功响应
   */
  static sendSuccess<T>(reply: FastifyReply, data: T, message = "操作成功"): void {
    const response = {
      code: 10000,
      message,
      data,
    };
    
    reply.code(200).send(response);
  }

  /**
   * 发送分页响应
   */
  static sendPaginated<T>(
    reply: FastifyReply,
    list: T[],
    page: number,
    pageSize: number,
    total: number,
    message = "获取成功"
  ): void {
    const response = {
      code: 10000,
      message,
      data: {
        list,
        total,
        page,
        pageSize,
      },
    };
    
    reply.code(200).send(response);
  }

  /**
   * 发送错误响应
   */
  static sendError(
    reply: FastifyReply,
    code: number,
    message: string,
    statusCode = 400
  ): void {
    const response = {
      code,
      message,
      timestamp: new Date().toISOString(),
    };
    
    reply.code(statusCode).send(response);
  }

  /**
   * 发送未找到错误响应
   */
  static sendNotFound(reply: FastifyReply, message = "资源不存在"): void {
    this.sendError(reply, ErrorCode.RESOURCE_NOT_FOUND, message, 404);
  }

  /**
   * 发送参数错误响应
   */
  static sendBadRequest(reply: FastifyReply, message = "参数错误"): void {
    this.sendError(reply, ErrorCode.INVALID_PARAMETER, message, 400);
  }
}
```

## 7. 错误处理规范

系统使用统一的错误码体系，通过 `BusinessCode` 管理。

## 8. 插件配置规范

系统使用 Fastify 插件模式进行功能扩展。插件分为外部插件（external）和应用插件（app）两类。

### 8.1 插件目录结构

```
src/plugins/
├── external/          # 外部插件配置
│   ├── prisma.ts      # Prisma 数据库连接插件
│   ├── redis.ts       # Redis 缓存插件
│   └── schemas.ts    # Schema 注册插件
└── app/               # 应用插件配置
    ├── auth.ts        # 认证插件
    ├── cors.ts        # CORS 配置插件
    └── swagger.ts     # Swagger 文档插件
```

### 8.2 插件注册机制

```typescript
// src/app.ts - 主应用配置
import Fastify from "fastify";
import AutoLoad from "@fastify/autoload";
import { join } from "path";

const server = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  },
});

// 注册外部插件
server.register(AutoLoad, {
  dir: join(__dirname, "plugins/external"),
  options: {},
});

// 注册应用插件
server.register(AutoLoad, {
  dir: join(__dirname, "plugins/app"),
  options: {},
});

// 注册路由
server.register(AutoLoad, {
  dir: join(__dirname, "routes"),
  options: {},
  routeParams: "true",
});
```

### 8.3 Schema 插件配置

```typescript
// src/plugins/external/schemas.ts
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export interface SchemasPluginOptions {}

export default fp<SchemasPluginOptions>(
  async (fastify: FastifyInstance, options: SchemasPluginOptions) => {
    // Schema 插件会自动加载 schemas/index.ts
    await import("../../schemas/index.js");
  }
);
```

### 8.4 Schema 注册实现

```typescript
// src/schemas/index.ts
import fp from "fastify-plugin";
import { registerCommon } from "./common.js";
import { registerUser } from "./user.js";

export default fp(async (fastify) => {
  // 注册通用 Schema
  registerCommon(fastify);
  
  // 注册用户相关 Schema
  registerUser(fastify);
});
```

### 7.1 错误码结构

```typescript
// ============= 成功码 =============
export const SUCCESS_CODE = 10000;

// ============= 错误码 =============
export const ErrorCode = {
  // 系统错误 (20xxx)
  SYSTEM_ERROR: 20001,
  DATABASE_ERROR: 20002,
  CACHE_ERROR: 20003,
  
  // 参数错误 (21xxx)
  INVALID_PARAMETER: 21001,
  MISSING_PARAMETER: 21002,
  PARAMETER_TYPE_ERROR: 21003,
  PARAMETER_FORMAT_ERROR: 21004,
  
  // 权限错误 (22xxx)
  UNAUTHORIZED: 22001,
  FORBIDDEN: 22002,
  TOKEN_INVALID: 22003,
  TOKEN_EXPIRED: 22004,
  
  // 用户模块 (30xxx)
  USER_NOT_FOUND: 30001,
  USER_ALREADY_EXISTS: 30002,
  USER_DISABLED: 30003,
  PASSWORD_ERROR: 30004,
  
  // 资源错误 (31xxx)
  RESOURCE_NOT_FOUND: 31001,
  RESOURCE_ALREADY_EXISTS: 31002,
  
  // 业务错误 (32xxx)
  BUSINESS_ERROR: 32001,
  OPERATION_NOT_ALLOWED: 32002,
  STATUS_INVALID: 32003,
} as const;
```

### 7.2 错误信息映射

```typescript
// ============= 错误信息映射 =============
export const ErrorMessages = {
  // 成功码
  [SUCCESS_CODE]: '操作成功',
  
  // 系统错误 (20xxx)
  [ErrorCode.SYSTEM_ERROR]: '系统内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库错误',
  [ErrorCode.CACHE_ERROR]: '缓存错误',
  
  // 参数错误 (21xxx)
  [ErrorCode.INVALID_PARAMETER]: '参数错误',
  [ErrorCode.MISSING_PARAMETER]: '缺少必要参数',
  [ErrorCode.PARAMETER_TYPE_ERROR]: '参数类型错误',
  [ErrorCode.PARAMETER_FORMAT_ERROR]: '参数格式错误',
  
  // 权限错误 (22xxx)
  [ErrorCode.UNAUTHORIZED]: '未授权访问',
  [ErrorCode.FORBIDDEN]: '权限不足',
  [ErrorCode.TOKEN_INVALID]: '无效的访问令牌',
  [ErrorCode.TOKEN_EXPIRED]: '访问令牌已过期',
  
  // 用户模块 (30xxx)
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.USER_DISABLED]: '用户已被禁用',
  [ErrorCode.PASSWORD_ERROR]: '密码错误',
  
  // 资源错误 (31xxx)
  [ErrorCode.RESOURCE_NOT_FOUND]: '资源不存在',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: '资源已存在',
  
  // 业务错误 (32xxx)
  [ErrorCode.BUSINESS_ERROR]: '业务处理失败',
  [ErrorCode.OPERATION_NOT_ALLOWED]: '操作不允许',
  [ErrorCode.STATUS_INVALID]: '状态无效',
} as const;
```

### 7.3 HTTP状态码映射

```typescript
// ============= HTTP状态码映射 =============
export const HttpStatusMap = {
  // 成功码
  [SUCCESS_CODE]: 200,
  
  // 系统错误 (20xxx)
  [ErrorCode.SYSTEM_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  
  // 参数错误 (21xxx)
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.MISSING_PARAMETER]: 400,
  [ErrorCode.PARAMETER_TYPE_ERROR]: 400,
  [ErrorCode.PARAMETER_FORMAT_ERROR]: 400,
  
  // 权限错误 (22xxx)
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  
  // 用户模块 (30xxx)
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.USER_ALREADY_EXISTS]: 409,
  [ErrorCode.USER_DISABLED]: 403,
  [ErrorCode.PASSWORD_ERROR]: 401,
  
  // 资源错误 (31xxx)
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  
  // 业务错误 (32xxx)
  [ErrorCode.BUSINESS_ERROR]: 400,
  [ErrorCode.OPERATION_NOT_ALLOWED]: 403,
  [ErrorCode.STATUS_INVALID]: 400,
} as const;

export class BusinessCode {
  // 获取错误信息
  static getMessage(code: number): string {
    return ErrorMessages[code] || "未知错误";
  }

  // 获取HTTP状态码
  static getHttpStatus(code: number): number {
    return HttpStatusMap[code] || 500;
  }

  // 判断是否为成功码
  static isSuccess(code: number): boolean {
    return code === SUCCESS_CODE;
  }

  // 判断是否为错误码
  static isError(code: number): boolean {
    return code !== SUCCESS_CODE;
  }

  // 获取错误码对应的错误类型
  static getErrorType(code: number): string {
    if (code >= 20000 && code < 21000) return "系统错误";
    if (code >= 21000 && code < 22000) return "参数错误";
    if (code >= 22000 && code < 23000) return "权限错误";
    if (code >= 30000 && code < 31000) return "用户错误";
    if (code >= 31000 && code < 32000) return "资源错误";
    if (code >= 32000 && code < 33000) return "业务错误";
    return "未知错误";
  }
}

## 10. 日志规范



## 17. 文档总结

本文档涵盖了 Yishan API 项目的完整开发规范，包括：

### 17.1 核心规范
- **路由层规范**: RESTful API 设计，清晰的文件组织结构
- **服务层规范**: 业务逻辑封装，错误处理机制
- **模型层规范**: Prisma 数据访问，类型安全
- **Schema 规范**: TypeBox 类型验证，请求响应验证

### 17.2 技术栈
- **框架**: Fastify + TypeScript
- **数据库**: Prisma + MySQL
- **验证**: TypeBox + JSON Schema
- **认证**: JWT + Bearer Token
- **日志**: Pino + pino-pretty
- **测试**: Jest + Supertest

### 17.3 最佳实践
- **代码组织**: 模块化、分层设计
- **错误处理**: 统一的错误码和响应格式
- **类型安全**: TypeScript + TypeBox 双重保障
- **性能优化**: 缓存、分页、查询优化
- **安全防护**: 输入验证、SQL注入防护、敏感信息处理
- **监控运维**: 健康检查、日志监控、性能监控

### 17.4 后续规划
- 持续优化 API 性能
- 完善测试覆盖率
- 加强安全防护措施
- 建立完善的监控体系
- 定期更新技术栈版本

---

**文档版本**: v1.0  
**最后更新**: 2024年  
**维护团队**: Yishan API 开发团队

## 11. 开发规范总结

### 11.1 命名规范

- **文件名**: 使用 kebab-case，如 `user-service.ts`
- **类名**: 使用 PascalCase，如 `UserService`
- **函数名**: 使用 camelCase，如 `getUserList`
- **常量名**: 使用 UPPER_SNAKE_CASE，如 `ERROR_CODE`
- **数据库字段**: 使用 snake_case，如 `created_at`
- **路由路径**: 使用 kebab-case，如 `/api/v1/admin/users`
- **Schema名称**: 使用 PascalCase + Schema，如 `UserListRespSchema`

### 11.2 代码组织规范

- **模块化**: 按功能模块组织代码
- **单一职责**: 每个函数/类只负责一个功能
- **依赖注入**: 使用依赖注入管理依赖关系
- **错误处理**: 统一错误处理机制
- **日志记录**: 统一的日志记录规范
- **配置分离**: 配置与业务逻辑分离
- **接口与实现**: 接口定义与实现分离

### 11.3 最佳实践

- **类型安全**: 充分利用 TypeScript 的类型系统
- **异步处理**: 使用 async/await 处理异步操作
- **错误边界**: 设置错误边界处理异常
- **性能优化**: 合理使用缓存和索引
- **安全规范**: 输入验证、SQL注入防护等
- **代码复用**: 提取公共逻辑，避免重复代码
- **测试覆盖**: 编写单元测试和集成测试

### 11.4 项目结构最佳实践

```
src/
├── config/           # 配置文件
│   ├── database.ts   # 数据库配置
│   ├── redis.ts      # Redis配置
│   └── logger.ts     # 日志配置
├── controllers/      # 控制器层
│   └── user.controller.ts
├── models/          # 数据模型层
│   └── user.model.ts
├── services/        # 业务逻辑层
│   └── user.service.ts
├── routes/          # 路由层
│   └── api/v1/admin/users/
├── schemas/         # Schema定义
│   ├── common.ts    # 通用Schema
│   └── user.ts      # 用户相关Schema
├── plugins/         # 插件配置
│   ├── external/    # 外部插件
│   └── app/         # 应用插件
├── utils/           # 工具类
│   ├── response.ts  # 响应工具
│   └── error.ts     # 错误处理工具
└── types/           # 类型定义
    └── user.ts      # 用户相关类型
```


## 12. 安全规范

### 12.1 认证授权规范

```typescript
// JWT 认证中间件示例
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return ResponseUtil.sendError(reply, ErrorCode.UNAUTHORIZED, '未提供认证令牌');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;
  } catch (error) {
    return ResponseUtil.sendError(reply, ErrorCode.TOKEN_INVALID, '认证令牌无效');
  }
};
```

### 12.2 输入验证规范

```typescript
// 使用 TypeBox Schema 进行输入验证
const CreateUserSchema = Type.Object({
  username: Type.String({ minLength: 3, maxLength: 50 }),
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 6 }),
  roleId: Type.Number({ minimum: 1 })
});

// 在路由中使用
fastify.post('/', {
  schema: {
    body: CreateUserSchema,
    // ...
  }
}, async (request, reply) => {
  // request.body 已经过验证
  const { username, email, password, roleId } = request.body;
  // ...
});
```

### 12.3 SQL 注入防护

```typescript
// 使用 Prisma ORM 防止 SQL 注入
const users = await prisma.sysUser.findMany({
  where: {
    username: {
      contains: keyword // Prisma 会自动处理特殊字符
    }
  }
});

// 不要直接拼接 SQL 字符串
// ❌ 错误做法
const users = await prisma.$queryRaw`SELECT * FROM sys_user WHERE username LIKE '%${keyword}%'`;

// ✅ 正确做法
const users = await prisma.$queryRaw`SELECT * FROM sys_user WHERE username LIKE ${`%${keyword}%`}`;
```

### 12.4 敏感信息处理

```typescript
// 密码加密
import bcrypt from 'bcrypt';

export class UserService {
  static async createUser(data: CreateUserData) {
    // 密码加密
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    return await UserModel.createUser({
      ...data,
      password: hashedPassword
    });
  }
  
  static async verifyPassword(plainPassword: string, hashedPassword: string) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

// 响应中移除敏感信息
export class UserModel {
  static async getUserById(id: number) {
    const user = await prisma.sysUser.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // 不包含 password 字段
      }
    });
    return user;
  }
}
```

## 13. 性能优化规范

### 13.1 数据库查询优化

```typescript
// 使用索引
const users = await prisma.sysUser.findMany({
  where: {
    username: username // username 字段有索引
  }
});

// 分页查询
const [total, list] = await Promise.all([
  prisma.sysUser.count({ where }),
  prisma.sysUser.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' }
  })
]);

// 避免 N+1 查询
const users = await prisma.sysUser.findMany({
  include: {
    role: true, // 一次查询加载关联数据
    parent: true
  }
});
```

### 13.2 缓存使用规范

```typescript
// Redis 缓存示例
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

export class CacheService {
  // 获取缓存
  static async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  // 设置缓存
  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }
  
  // 删除缓存
  static async del(key: string): Promise<void> {
    await redis.del(key);
  }
}

// 在 UserService 中使用缓存
export class UserService {
  static async getUserById(id: number) {
    // 先从缓存获取
    const cacheKey = `user:${id}`;
    let user = await CacheService.get(cacheKey);
    
    if (!user) {
      // 缓存中没有，从数据库获取
      user = await UserModel.getUserById(id);
      if (user) {
        // 存入缓存，TTL 1小时
        await CacheService.set(cacheKey, user, 3600);
      }
    }
    
    return user;
  }
  
  static async updateUser(id: number, data: UpdateUserData) {
    const user = await UserModel.updateUser(id, data);
    // 更新用户信息时删除缓存
    await CacheService.del(`user:${id}`);
    return user;
  }
}
```

### 13.3 异步处理优化

```typescript
// 并行处理多个异步操作
const [users, total, roles] = await Promise.all([
  UserModel.getUserList(page, pageSize),
  UserModel.getUserTotal(),
  RoleModel.getAllRoles()
]);

// 批量操作
const createUsers = async (userDataList: CreateUserData[]) => {
  // 使用 Prisma 事务
  return await prisma.$transaction(async (tx) => {
    const createdUsers = [];
    for (const userData of userDataList) {
      const user = await tx.sysUser.create({ data: userData });
      createdUsers.push(user);
    }
    return createdUsers;
  });
};
```

## 14. 测试规范

### 14.1 测试目录结构

```
test/
├── unit/            # 单元测试
│   ├── services/
│   ├── models/
│   └── utils/
├── integration/     # 集成测试
│   ├── api/
│   └── database/
└── fixtures/        # 测试数据
    └── users.ts
```

### 14.2 单元测试示例

```typescript
// test/unit/services/user.service.test.ts
import { UserService } from '../../../src/services/user.service';
import { UserModel } from '../../../src/models/user.model';

jest.mock('../../../src/models/user.model');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUserList', () => {
    it('should return paginated user list', async () => {
      // 准备测试数据
      const mockUsers = [
        { id: 1, username: 'user1', email: 'user1@example.com' },
        { id: 2, username: 'user2', email: 'user2@example.com' }
      ];
      const mockTotal = 2;
      
      // 模拟 UserModel 方法
      (UserModel.getUserList as jest.Mock).mockResolvedValue(mockUsers);
      (UserModel.getUserTotal as jest.Mock).mockResolvedValue(mockTotal);
      
      // 执行测试
      const result = await UserService.getUserList({ page: 1, pageSize: 10 });
      
      // 验证结果
      expect(result.list).toEqual(mockUsers);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
    
    it('should handle keyword search', async () => {
      const keyword = 'test';
      const mockUsers = [{ id: 1, username: 'testuser', email: 'test@example.com' }];
      
      (UserModel.getUserList as jest.Mock).mockResolvedValue(mockUsers);
      (UserModel.getUserTotal as jest.Mock).mockResolvedValue(1);
      
      const result = await UserService.getUserList({ 
        page: 1, 
        pageSize: 10, 
        keyword 
      });
      
      expect(UserModel.getUserList).toHaveBeenCalledWith(
        expect.objectContaining({ keyword })
      );
    });
  });
});
```

### 14.3 集成测试示例

```typescript
// test/integration/api/user.test.ts
import { build } from '../../../src/app';
import { FastifyInstance } from 'fastify';

describe('User API Integration Tests', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    app = await build();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('GET /api/v1/admin/users', () => {
    it('should return user list with authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        query: { page: 1, pageSize: 10 },
        headers: {
          authorization: 'Bearer valid-token'
        }
      });
      
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.code).toBe(0);
      expect(data.data).toHaveProperty('list');
      expect(data.data).toHaveProperty('total');
    });
    
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        query: { page: 1, pageSize: 10 }
      });
      
      expect(response.statusCode).toBe(401);
    });
  });
});
```

## 15. 部署规范

### 15.1 环境配置

```bash
# .env.example
NODE_ENV=development
PORT=3000
DATABASE_URL="mysql://user:password@localhost:3306/yishan"
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=your-jwt-secret-key
LOG_LEVEL=info
```

### 15.2 Docker 配置

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制包文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
```

### 15.3 健康检查

```typescript
// src/routes/health.ts
import { FastifyPluginAsync } from 'fastify';

const health: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/health', async (request, reply) => {
    try {
      // 检查数据库连接
      await fastify.prisma.$queryRaw`SELECT 1`;
      
      // 检查 Redis 连接
      await fastify.redis.ping();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  });
};

export default health;
```

## 16. 监控规范

### 16.1 应用监控

```typescript
// src/plugins/monitoring.ts
import { FastifyPluginAsync } from 'fastify';

const monitoring: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // 请求耗时监控
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
  });
  
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    
    fastify.log.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      userAgent: request.headers['user-agent'],
      ip: request.ip
    });
    
    // 可以发送到监控系统
    // metrics.recordRequest(request.method, request.url, reply.statusCode, duration);
  });
  
  // 错误监控
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error('Request error', {
      method: request.method,
      url: request.url,
      error: error.message,
      stack: error.stack
    });
    
    // 发送到错误监控系统
    // errorTracker.captureException(error, { request });
    
    // 使用默认错误处理
    reply.send(error);
  });
};

export default monitoring;
```

### 10.1 日志配置

```typescript
// src/config/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});
```

### 10.2 日志使用规范

```typescript
// 在路由中使用
import { logger } from "../config/logger.js";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/users", async (request, reply) => {
    logger.info("获取用户列表", { query: request.query });
    
    try {
      const users = await UserService.getUserList(request.query);
      logger.info("用户列表获取成功", { count: users.total });
      return ResponseUtil.sendSuccess(reply, users);
    } catch (error) {
      logger.error("用户列表获取失败", { error: error.message });
      throw error;
    }
  });
}
```

### 10.3 日志级别规范

- **fatal**: 系统崩溃级别错误，需要立即处理
- **error**: 业务错误，影响功能正常使用
- **warn**: 警告信息，不影响功能但需要注意
- **info**: 重要业务信息，如用户登录、数据变更等
- **debug**: 调试信息，仅在开发环境使用
- **trace**: 最详细的跟踪信息，用于问题排查

### 10.4 日志内容规范

```typescript
// 好的日志示例
logger.info("用户登录成功", {
  userId: user.id,
  username: user.username,
  ip: request.ip,
  userAgent: request.headers["user-agent"]
});

// 不好的日志示例
logger.info("登录了"); // 缺少上下文信息
```
```