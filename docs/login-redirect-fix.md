# 登录跳转与二级目录问题排查文档

## 问题描述

### 问题 1: 登录后跳转到 `/user/login` 而不是 `/admin/`

**现象**：用户登录成功后，浏览器地址栏变成 `http://localhost:3000/` 而不是管理后台

**原因**：`process.env.PUBLIC_PATH` 在浏览器运行时是 `undefined`（因为没有 `process` 对象），导致 `adminBase` 计算出错

### 问题 2: 访问根路径 `/` 没有重定向到 `/admin/`

**现象**：访问 `https://demo.zerocmf.com/` 显示 JSON 健康检查响应，而不是跳转到管理后台

**原因**：`apps/yishan-api/src/core/routes/root.ts` 只返回 JSON，没有 redirect 逻辑

---

## PUBLIC_PATH 实现原理

### 构建时配置

**文件**：`apps/yishan-admin/config/config.ts:18-19`

```typescript
const rawPublicPath = process.env.PUBLIC_PATH || '/';
const PUBLIC_PATH = normalizePublicPath(rawPublicPath);
```

### 用途

| 配置项 | 作用 |
|--------|------|
| `base: PUBLIC_PATH` | 路由 base，Umi 自动为 `history.push` 路径添加此前缀 |
| `publicPath: PUBLIC_PATH` | webpack 资源加载路径 |

### 工具函数

**文件**：`apps/yishan-admin/shared/publicPath.ts`

```typescript
normalizePublicPath('/admin/')      → '/admin/'
getBasePrefixFromPublicPath('/admin/') → 'admin'  // 去掉首尾斜杠
stripBasePrefix('/admin/user/login', 'admin') → '/user/login'
```

### 问题根因

`process.env.PUBLIC_PATH` 是 **Node.js 构建时**环境变量，在浏览器运行时是 `undefined`。

```bash
# 构建时（Node.js）
PUBLIC_PATH=/admin/ pnpm build  # 有效

# 运行时（浏览器）
process.env.PUBLIC_PATH  // undefined！
```

---

## 修复方案

### 修复 1: 登录跳转逻辑

**文件**：`apps/yishan-admin/src/pages/user/login/index.tsx`

**核心改动**：使用 `history.push` 代替 `window.location.href`，利用 Umi 自动处理 base 前缀

```typescript
// 从当前 URL 推断 base 前缀
const resolveRedirectAfterLogin = () => {
  const redirect = new URL(window.location.href).searchParams.get("redirect");
  if (!redirect) return '/';
  try {
    const target = new URL(redirect, window.location.origin);
    const currentPath = window.location.pathname;
    const loginPath = '/user/login';
    // 从 /admin/user/login 推断 basePrefix = /admin
    const basePrefix = currentPath.endsWith(loginPath)
      ? currentPath.slice(0, -loginPath.length)
      : currentPath.split('/').slice(0, -1).join('/') || '/';
    let normalizedPath = target.pathname;
    // 去掉 base 前缀，转换为相对路径
    if (normalizedPath.startsWith(basePrefix)) {
      normalizedPath = normalizedPath.slice(basePrefix.length) || '/';
    }
    // / 和 /user/login 都跳转到 /
    if (normalizedPath === "/user/login" || normalizedPath === "/") {
      return '/';
    }
    return normalizedPath;
  } catch {
    return '/';
  }
};

// 登录成功后使用 history.push（Umi 自动加上 base 前缀）
history.push(resolveRedirectAfterLogin());
```

**为什么不依赖 `process.env.PUBLIC_PATH`**：
- 构建时正确传递可以工作
- 但代码分割（code splitting）可能导致异步 chunk 没有正确接收到
- 从 `window.location.pathname` 推断更可靠

### 修复 2: 根路径重定向（待处理）

**文件**：`apps/yishan-api/src/core/routes/root.ts`

**当前代码**：
```typescript
fastify.get('/', async function (request, reply) {
  return {
    status: 'ok',
    message: 'Service is healthy',
    timestamp: dateUtils.now(),
    version: process.env.npm_package_version || '1.0.0'
  }
})
```

**建议修改**：
```typescript
fastify.get('/', async function (request, reply) {
  return reply.redirect('/admin');
})
```

---

## 测试验证

### 测试命令

```bash
# 1. 构建 tiptap 依赖
pnpm --filter yishan-tiptap build

# 2. 构建 admin（设置 PUBLIC_PATH）
PUBLIC_PATH=/admin/ pnpm --filter yishan-admin build

# 3. 复制到 API 静态目录
rm -rf apps/yishan-api/public/admin
mkdir -p apps/yishan-api/public/admin
cp -R apps/yishan-admin/dist/* apps/yishan-api/public/admin/

# 4. 启动 API
cd apps/yishan-api && node dist/server.js

# 5. Playwright 测试
node /tmp/test-login.js
```

### 预期结果

| 测试场景 | 预期行为 |
|----------|----------|
| 访问 `/` | 返回 JSON 健康检查（未修复时）或 redirect 到 `/admin`（修复后） |
| 访问 `/admin/` | 未登录则跳转到 `/admin/user/login?redirect=%2Fadmin%2F` |
| 登录成功后 | 跳转到 `/admin/` 或 `/admin/xxx` |

---

## CI 构建配置

确保生产构建时正确设置 `PUBLIC_PATH`：

```yaml
# .github/workflows/deploy.yml 或 CI 配置
- name: Build Admin
  run: |
    pnpm --filter yishan-tiptap build
    PUBLIC_PATH=/admin/ pnpm --filter yishan-admin build
```

---

## 文件变更汇总

| 文件 | 变更 |
|------|------|
| `apps/yishan-admin/src/pages/user/login/index.tsx` | 添加 `history.push`、重写 `resolveRedirectAfterLogin` |
| `apps/yishan-api/src/core/routes/root.ts` | 待添加 `reply.redirect('/admin')` |
