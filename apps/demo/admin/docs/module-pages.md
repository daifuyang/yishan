# 模块页面注册机制

业务页面位于产品 `apps/demo/admin`，系统管理页面由 `@yishan/core-system-admin` 公开贡献。表单约定见 [form-pattern.md](form-pattern.md)，后端与安装规则见 [模块接入](../../../docs/content/modules/onboarding.md)。

## 构建与运行时

产品 `plugin.ts` 通过公开 `@yishan/core-admin/umi-plugin` 创建 Umi 插件。产品传入自己的 API 根目录和系统页面贡献；公共插件不硬编码 Demo 或扫描其它产品。安装事实来自同产品 API 的显式 `src/manifest.ts`，由 `@yishan/core-admin/manifest` 静态解析，不执行后端模块代码或连接数据库。

构建期 `onGenerateFiles` 生成 `src/.umi/module-components.ts`。它包含产品框架页面、公开系统页面贡献以及已安装业务模块的页面。未安装模块即使保留源码，也不会加入页面组件映射。运行时菜单的 `sys_menu.component` 只选择组件映射中的页面。

插件生成动态 `import()` 加载工厂，避免依赖 Mako 浏览器运行时不可用的 `require.context`。Umi 临时目录由构建生成，不提交。

## 路径约定

| 字段 | 形式 | 示例 |
|---|---|---|
| 菜单 URL | `/<id>/<page>` | `/portal/articles` |
| 产品业务源码 | `src/modules/<id>/pages/<page>/index.tsx` | `src/modules/portal/pages/articles/index.tsx` |
| 菜单 component | `./modules/<id>/<page>` | `./modules/portal/articles` |
| 产品页面 import | `@/modules/<id>/pages/<page>` | `@/modules/portal/pages/articles` |
| 系统菜单 component | 保留既有组件键 | `./system/user` |

URL 不带 `/modules/`；菜单 component 必须保留 `./modules/` 前缀。系统页面位置迁入公开包后，既有 `./system/user` 等菜单键仍有效。

## 新增业务页面

以已安装的 portal 模块新增 tags 页面为例：

1. 在 `apps/demo/admin/src/modules/portal/pages/tags/index.tsx` 创建默认导出的 React 页面。页面组合沿用 PageContainer / ProTable。
2. 在产品 API 的 `src/modules/portal/config/system-menu.json` 声明菜单节点，URL 为 `/portal/tags`，component 为 `./modules/portal/tags`。
3. 在模块的 `permissions.ts` 集中声明权限，在 routes / services / repositories / schemas 实现接口；按 [模块接入](../../../docs/content/modules/onboarding.md) 安装模块。
4. 需要接口契约时，先审查 OpenAPI，再运行 `pnpm --filter @yishan/demo-admin openapi`。生成客户端与 typings 一起提交。
5. 运行 `pnpm --filter @yishan/demo-admin exec max setup` 与相关检查，确认组件映射包含新页面。开发服务器必要时重启。

仅新增页面文件不会安装未安装模块。产品清单决定是否参与构建，后端菜单决定用户可见入口，权限决定实际访问行为。

## 框架路由与排查

`apps/demo/admin/config/routes.ts` 声明登录、首页容器、404 等框架路由；公开报价 `/q/:token` 仅在 CRM 安装时声明。菜单驱动的业务页面在运行时动态注入，通常无需重复添加静态路由。

| 现象 | 检查 |
|---|---|
| 菜单跳 404 | component 键是否正确，模块是否安装，页面是否默认导出 |
| 新页面未进入组件映射 | 产品安装清单、页面路径与公开插件配置 |
| 改动未刷新 | 重新运行 max setup 或重启开发服务器 |
| 权限不可见 | 后端权限声明、角色授权和当前用户权限数据 |

运行 `pnpm check:boundaries` 检查公开导入与包依赖；共享包不能跨产品读取页面或客户端。线上路径仍为 `/admin/`，不要手动重复拼接路由 base。
