---
title: 认证与安全
---

# 认证与安全

前端通过本地存储管理访问令牌与刷新令牌，并在请求时自动附加 `Authorization` 头。相关工具位于：

- `src/utils/token.ts`：保存/获取/清理 token、过期判断、构建授权头
- `src/utils/auth.ts`：注销流程、当前用户本地缓存

## Token 管理

`src/utils/token.ts` 维护键名与过期时间，示例：

```ts
export const TOKEN_KEYS = { ACCESS_TOKEN: 'accessToken', REFRESH_TOKEN: 'refreshToken', ACCESS_TOKEN_EXPIRY: 'accessTokenExpiry', REFRESH_TOKEN_EXPIRY: 'refreshTokenExpiry', TOKEN_TYPE: 'tokenType' } as const;

export const getAuthorizationHeader = (): string | null => {
  const token = getAccessToken();
  const tokenType = getTokenType();
  return token ? `${tokenType} ${token}` : null;
};
```

## 自动刷新令牌

在 `src/requestErrorConfig.ts` 中，当收到 `401` 时会尝试使用刷新令牌获取新的访问令牌，并刷新页面以恢复会话。

## 注销与跳转

`logout()` 会调用后端登出接口并清理本地状态，同时根据当前路径智能跳转到登录页。