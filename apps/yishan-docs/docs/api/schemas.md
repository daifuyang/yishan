---
title: 校验 Schema
---

# 校验 Schema

后端使用 TypeBox 定义请求与响应的 Schema，并在路由中引用 `$ref` 进行复用：

- 位置：`src/schemas/*`
- 示例：用户列表查询 `user.ts` 导出 `userListQuery` 与 `userListResp`

在路由中：

```ts
schema: {
  querystring: { $ref: 'userListQuery#' },
  response: { 200: { $ref: 'userListResp#' } },
}
```

这样可以通过 Swagger 自动生成接口文档并进行参数校验。