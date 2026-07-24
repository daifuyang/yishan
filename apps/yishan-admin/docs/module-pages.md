# 模块页面注册机制

> 本文讲清楚一件事：把一个新模块页面从无到有挂到 admin 后台，**总共需要改哪些地方**。
>
> 配套文档：
> - 表单模板（DrawerForm + FormEditor + ProTable 骨架）→ 本目录 `form-pattern.md`
> - 后端模块规范 → `apps/yishan-api/docs/module-pattern.md`

## 1. 核心机制

`apps/yishan-admin/plugin.ts` 是 admin **唯一**的模块扩展点。它在编译期跑 `onGenerateFiles`，扫描两处目录：

```
src/pages/         →  ./xxx/yyy            →  @/pages/xxx/yyy
src/modules/<id>/pages/<page>/index.tsx  →  ./modules/<id>/<page>  →  @/modules/<id>/pages/<page>
```

把扫到的虚拟路径写到 `.umi/module-components.ts`，运行时由 `moduleComponentsMap` 解析。

> 为什么不直接 `require.context`？当前 Umi 集成的 Mako 0.11.10 在浏览器运行时会抛 `require.context is only available in Mako/webpack bundler runtime`。改用编译期生成 + `import()` 动态加载规避。

## 2. 路径对照

| 字段 | 形式 | 例 |
|---|---|---|
| **URL（前端菜单 `path`）** | `/<id>/<page>` | `/portal/articles` |
| **源码物理路径** | `src/modules/<id>/pages/<page>/index.tsx` | `src/modules/portal/pages/articles/index.tsx` |
| **菜单 `component` 字段** | `./modules/<id>/<page>` | `./modules/portal/articles` |
| **运行时 import path** | `@/modules/<id>/pages/<page>` | `@/modules/portal/pages/articles` |

**重点**：

- URL **不要**带 `/modules/` 前缀（`/modules/` 只是源码目录约定）
- 菜单 `component` **必须**带 `./modules/` 前缀（不能漏，否则 404，参 commit `0023d2f` 的修复）
- Core 页面用 `src/pages/system/user/index.tsx` 这种形式，模块页面用 `src/modules/<id>/pages/<page>/index.tsx` 这种形式，**两类并存**

## 3. 新增一个模块页面，0 配置流程

假设要给 `portal` 模块加一个 `tags` 页面。**只需要做一件事**：在 `src/modules/portal/pages/tags/index.tsx` 写文件。

```tsx
// apps/yishan-admin/src/modules/portal/pages/tags/index.tsx
import { PageContainer } from '@ant-design/pro-components'
import React from 'react'

const TagsPage: React.FC = () => {
  return <PageContainer>标签管理</PageContainer>
}

export default TagsPage
```

然后：

1. **菜单 JSON 添加节点**（`apps/yishan-api/src/modules/portal/config/system-menu.json`）
   ```json
   {
     "type": 1,
     "name": "标签管理",
     "path": "/portal/tags",
     "sortOrder": 6,
     "icon": "TagsOutlined",
     "component": "./modules/portal/tags",
     "children": [
       { "type": 2, "name": "查看", "permissionCodes": ["portal:tag:list"], "sortOrder": 1, "hideInMenu": 1, "isDefaultAction": 1 }
     ]
   }
   ```
2. **权限码集中注册**（`apps/yishan-api/src/modules/portal/permissions.ts`）—— 加 `TAG_LIST: { code: 'portal:tag:list', ... }` 等
3. **后端接口 + 服务 + 仓储 + schema** —— 走 `module-pattern.md` 第 3 节
4. **跑 `pnpm --filter yishan-admin openapi`** 把新接口生成到 `src/services/generated/portal.ts`
5. **重跑 `pnpm start`**，admin 自动识别 `tags/index.tsx` 文件，无需手改路由

`plugin.ts` 重新 `onGenerateFiles` 触发条件是 `addTmpGenerateWatcherPaths` 添加的目录有变更：

```ts
api.addTmpGenerateWatcherPaths(() => [
  join(api.paths.absSrcPath, 'pages'),
  join(api.paths.absSrcPath, 'modules'),
])
```

所以 `src/modules/<id>/pages/` 任何文件增减都会让 `.umi/module-components.ts` 重新生成。

## 4. 排查清单

| 现象 | 原因 |
|---|---|
| 菜单点击跳 404 | 菜单 `component` 漏了 `./modules/` 前缀；或源码路径里少 `index.tsx` |
| 菜单点击白屏 | 模块页面 default export 不是 React 组件或没 export |
| 改了页面不生效 | `plugin.ts` watcher 没覆盖到；尝试 `rm -rf .umi && pnpm start` |
| 新建模块目录没被识别 | 目录里没有 `pages/<page>/index.tsx` 形式；`plugin.ts` 只扫到 `index.tsx` 才记录 |
| 编辑菜单崩溃 | `Access` 组件里读取 `initialState?.currentUser?.permissions` 为空，权限码未注册 |

## 5. 与 routes.ts 的关系

`apps/yishan-admin/config/routes.ts` 是 **core 页面**（`src/pages/` 下）的路由表，**不**包含模块页面。

```ts
// config/routes.ts (节选)
{ path: '/system/user', component: './system/user', ... }
```

- `component: './system/user'` 走 `src/pages/system/user/index.tsx`
- `component: './modules/portal/articles'` 走 `src/modules/portal/pages/articles/index.tsx`

两者机制一致，**路径前缀**不同是唯一区别。

新增页面**不要**改 `config/routes.ts`——菜单 JSON 才是模块页面的入口。
