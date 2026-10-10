---
title: OpenAPI 接口生成
---

# OpenAPI 接口生成

Admin 包命令运行产品 `scripts/generate-openapi.cjs`，调用官方 `@umijs/openapi.generateService`。输入为已提交、来自当前同产品 API 的 `apps/demo/api/openapi.json`，请求库使用 `@umijs/max` 的 request。生成入口按路径和当前安装清单划分所有权。

| 接口归属 | 生成位置 | 类型命名空间 |
|---|---|---|
| System 公共接口 | `packages/core/system-admin/src/services/generated/` | `SystemAPI` |
| 已安装产品模块 | `apps/demo/admin/src/services/generated/` | `API` |
| 未安装 CRM 的保留快照 | `apps/demo/admin/src/modules/crm/services/generated/` | `CrmAPI` |

系统客户端通过 `@yishan/core-system-admin/services/<service>` 的公开 export 使用。产品业务客户端仍从产品 `@/services/generated/<module>` 导入。CRM 快照属于业务模块源码，保留快照不会安装 API 或注册前端页面。

接口变更后，从根目录执行：

~~~bash
pnpm build:api
# 使用正确环境启动 Demo API 后，读取 /api/docs/json。
pnpm --filter @yishan/demo-api openapi:dump
pnpm --filter @yishan/demo-admin openapi
pnpm check:openapi
~~~

Demo 默认端口为 3100；可用 `pnpm --filter @yishan/demo-api openapi:dump http://127.0.0.1:3100` 指定服务地址，第二个位置参数可指定输出文件。同步提交 TypeBox schema、Fastify 路由、OpenAPI JSON、生成客户端及类型，手写 UI 保留既有组织方式。

生成器将产品分区写到产品 `node_modules/.cache/admin-openapi/product.json`；Umi 的 OpenAPI 配置使用该缓存分区，避免直接 `max openapi` 把系统接口再次生成进产品。重新生成 System 与产品两类客户端使用上述包命令，服务文件与各自的 typings 一起提交。缓存和临时生成配置不提交。
