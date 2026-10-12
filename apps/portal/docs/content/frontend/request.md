---
title: 请求与错误处理
---

# 请求与错误处理

统一的请求配置位于 `src/requestErrorConfig.ts`，包含：

- 请求拦截：自动附加 `Authorization` 头
- 响应拦截：通用错误处理、业务错误分级展示
- 401 自动刷新令牌：使用刷新令牌获取新的访问令牌，失败则注销

```ts title="请求拦截片段"
requestInterceptors: [
  (config) => {
    const authHeader = getAuthorizationHeader();
    return authHeader ? { ...config, headers: { ...config.headers, Authorization: authHeader } } : config;
  },
],
```

响应结构与列表分页规范详见“前端列表规范”。