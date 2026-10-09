---
title: OpenAPI 接口生成
---

# OpenAPI 接口生成

Admin 使用 Umi OpenAPI 插件，从已提交的 apps/demo/api/openapi.json 生成 src/services/generated/ 中的请求方法与类型。配置位于 apps/yishan-admin/config/config.ts，schemaPath 为 ../../demo/api/openapi.json；请求库使用 @umijs/max 的 request。

接口变更后，从根目录执行：

~~~bash
pnpm build:api
# 使用正确环境启动 Demo API 后，读取 /api/docs/json。
pnpm --filter @yishan/demo-api openapi:dump
pnpm --filter yishan-admin openapi
pnpm check:openapi
~~~

Demo 默认端口为 3100；可用 `pnpm --filter @yishan/demo-api openapi:dump http://127.0.0.1:3100` 指定服务地址，第二个位置参数可指定输出文件。同步提交 TypeBox schema、Fastify 路由、OpenAPI JSON、生成客户端及类型，手写 UI 保留既有组织方式。
