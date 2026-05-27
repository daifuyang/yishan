---
title: 插件体系
---

# 插件体系

当前项目已具备后端插件运行时与前端插件路由生成机制。插件不是简单的页面分组，而是包含 manifest、菜单、权限、路由、生命周期与持久化状态的一组扩展能力。

## 后端插件

后端插件模块位于：

```text
apps/yishan-api/src/plugins/modules/<module-name>/
├─ manifest.ts
├─ routes/
├─ schemas/
└─ services/ 或 models/（按需）
```

启动时 `src/app.ts` 会：

- 扫描 `src/plugins/modules/*/manifest.ts`
- 注册 manifest 到 `plugins-runtime`
- 执行 load/enable 生命周期
- 同步插件菜单到系统菜单
- 将插件状态持久化到插件相关表
- 按模块加载 `routes/`，前缀为 `api/modules/<moduleName>`

示例：`portal` 插件目录名为 `portal`，运行时自动挂载后的管理端文章接口位于 `/api/modules/portal/v1/admin/articles`。

## 前端插件路由

前端插件 manifest 位于：

```text
apps/yishan-admin/src/plugins/modules/*.manifest.ts
```

安装后或构建前会执行：

```bash
pnpm --filter yishan-admin exec node scripts/generate-plugin-routes.mjs
```

生成文件：

```text
apps/yishan-admin/config/generated/plugin-routes.ts
```

`config/routes.ts` 只保留页面挂载与访问控制，菜单数据以后端 `sys_menu` 和插件 manifest 同步结果为准。

## 菜单路径约定

- 核心系统功能使用 `/system/*`，如 `/system/user`、`/system/apps`。
- 插件页面使用 `/plugins/<vendor>/<plugin>/*`，如 `/plugins/yishan/portal/articles`。
- 插件 API 使用 `/api/modules/<module>/v1/*`，如 `/api/modules/portal/v1/admin/articles`。

新增插件时，需要同时确认后端 manifest、前端 manifest、权限点、菜单同步和 OpenAPI 生成结果。
