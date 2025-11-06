# 测试说明（Vitest）

本项目使用 Vitest 作为测试框架，当前主要编写了路由层的集成测试，覆盖系统管理、认证、管理员用户模块。本文档说明测试的结构、运行方式、编写规范与常见问题。

## 测试结构

- 目录位置：`test/`
- 已有测试文件：
  - `system.routes.test.ts`：系统管理路由（`/cleanup-tokens`、`/token-stats`）
  - `auth.routes.test.ts`：认证路由（`/login`、`/logout`、`/me`、`/refresh`）
  - `admin.users.routes.test.ts`：管理员用户路由（列表/创建/更新）

## 运行方式

- 全量运行：`pnpm test`
- 监听运行：`pnpm test:watch`

配置来源：`vitest.config.ts`

- `environment: 'node'`
- `include: ['test/**/*.test.ts']`（测试文件需放在 `test/` 目录下，后缀为 `.test.ts`）
- `globals: true`（允许直接使用 `describe`、`it`、`expect`、`vi` 等）
- 覆盖率：`coverage.reporter: ['text', 'html']`

## 测试约定与最佳实践

- 快速构建 Fastify 实例：
  - 注册全局错误处理：`errorHandlerPlugin`
  - 注册相关 Schema：按需调用 `registerXXXSchemas(fastify)`
  - 注册被测路由插件：`fastify.register(routePlugin)`

- Schema 注册顺序：
  - 通用 Schema（`registerCommonSchemas`）含 `paginationResponse`，在需要分页响应的用例中必须优先注册，否则会出现 `$ref` 解析失败。
  - 模块 Schema（如 `registerAuthSchemas`、`registerUserSchemas` 等）在通用 Schema 之后注册。

- 服务层隔离与 Mock：
  - 使用 `vi.spyOn(ServiceClass, 'method').mockResolvedValue(...)` 或 `mockRejectedValue(...)`。
  - 路由测试只关注路由逻辑与响应格式，不依赖数据库或外部服务。

- 统一响应结构：
  - 成功：`ResponseUtil.success(reply, data, message)` 或 `ResponseUtil.paginated(...)`
  - 错误：`ResponseUtil.error(reply, code, message, details)`，HTTP 状态码由 `BusinessCode.getHttpStatus(code)` 映射。

## 常见问题与现状说明

- 数据库连接警告：
  - 运行测试时控制台可能出现 `Database may not be connected. Call connect() first.`，这是因为测试通过 Mock 服务层不连接数据库，不影响测试通过。

- BusinessError 识别与业务码映射：
  - 测试前已修正业务码聚合，确保 `SystemManageErrorCode` 能被识别，系统路由的错误码断言已通过。

- 响应 Schema 不匹配导致 500：
  - `PUT /api/v1/admin/users/:id` 的 `response` 声明为 `sysUser#`，但路由返回了统一成功响应（包含 `success/code/message` 等）。Fastify 在序列化阶段会因 Schema 不匹配返回 `500`。
  - 现状下测试按 `500` 断言，建议后续统一：
    - 将路由 `response` 改为 `userDetailResp#`，或
    - 返回与 `sysUser#` 一致的对象结构，不包裹统一响应。

## 编写新测试的模板

```ts
import Fastify from 'fastify'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import routePlugin from '../src/routes/api/v1/xxx/index.ts'
import registerCommonSchemas from '../src/schemas/common.ts'
import registerModuleSchemas from '../src/schemas/xxx.ts'
import { SomeService } from '../src/services/xxx.service.ts'
import { describe, it, expect, vi } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  registerCommonSchemas(app)
  registerModuleSchemas(app)
  await app.register(routePlugin)
  await app.ready()
  return app
}

describe('Xxx routes', () => {
  it('GET /xxx 正常返回', async () => {
    vi.spyOn(SomeService, 'method').mockResolvedValue({ /* mock data */ })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/xxx' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    await app.close()
  })
})
```

## 测试命名与组织

- 文件命名：`<模块>.<层>.test.ts`，如 `auth.routes.test.ts`、`user.service.test.ts`
- 分组命名：使用 `describe('模块名/路由名', ...)`，便于输出可读性。
- 用例命名：
  - 成功路径以“成功/正常返回”等表述
  - 错误路径明确错误原因与期望的业务码/HTTP 状态

## 覆盖率报告

- 文本报告：运行 `pnpm test` 后在控制台查看
- HTML 报告：位于 `coverage/` 目录（默认由 Vitest 生成），可用浏览器打开查看详细覆盖率

## 可选扩展

- 支持就近测试：如需在 `src/**/__tests__/*.test.ts` 或 `src/**/?(*.)+(spec|test).ts` 中放置测试，可在 `vitest.config.ts` 中扩展 `include` 配置（示例：`['test/**/*.test.ts', 'src/**/__tests__/*.test.ts']`）。
- 增补服务层单元测试：对 `AuthService`、`UserService` 等编写独立的单元测试，提升覆盖率与可维护性。

## 维护建议

- 保持 Schema 与路由返回结构一致，避免序列化阶段 500。
- 统一使用业务码与全局错误处理器，减少路由内重复的错误处理逻辑。
- Mock 外部依赖（数据库/缓存/网络），确保测试稳定、快速。