# 模块系统：两级开关（构建期打包 / 运行时启停）

> 记录移山模块系统的设计与用法。配合 `ARCHITECTURE.md` §3/§5/§9 与 `AGENTS.md` §3 阅读。

## 1. 为什么是两级开关

「模块是否可用」有两个**不同维度**的问题，各有唯一事实源，互不耦合：

| 维度 | 事实源 | 作用时机 | 效果 |
| --- | --- | --- | --- |
| **构建期打包** | 每模块 `module.json` 的 `build` 字段（git 跟踪） | `pnpm build` 时 | `build:false` 不编译、不进 `dist`、不参与打包，运行时根本不存在（交付包瘦身） |
| **运行时启停** | `sys_module.enabled`（多实例共享） | toggle 时 | 已打包模块的实时开关，全局 `onRequest` gate 拦截，**即时生效、零重启** |

**约束关系**：`运行时启用 ⟹ 必须已打包`（单向偏序，不是双向等值）。没打包的模块在运行时控制台里看不到，也无法启用。

**红线**：运行时 toggle **只写 DB，永不回写源码/meta 文件**（生产产物只读、多实例会各写各的、git 会变脏）。改打包走开发态显式命令。

## 2. 模块目录约定

```
apps/yishan-api/src/modules/<id>/
├── routes.ts          # export const meta = { id, name, defaultEnabled, tablePrefix, version } + 默认 Fastify 插件
├── module.json        # { "id": "<id>", "build": true }  ← 构建期打包开关，唯一事实源
├── routes/            # 真正被 autoload 扫描的路由目录（裸 fastify.get/post）
├── db/schema.ts       # Drizzle 表定义（表名以 <id>_ 开头）
├── drizzle.config.ts  # 模块自带 drizzle-kit 配置
├── drizzle/           # 迁移 SQL + meta
├── repositories/ services/ schemas/ tests/
```

- 路由 prefix 硬约定 `/api/<id>`，由 `core/module-loader.ts` 的 `moduleRoutePrefix()` **唯一生成**（loader / list 路由 / 前端都用它，不再各自硬编码）。
- `meta.id` = 目录名，天然唯一；不再有 `meta.prefix`，不做 prefix 唯一性校验。

## 3. 运行时链路（boot）

`apps/yishan-api/src/app.ts`：

1. 注册 `core/plugins/external/*` 与 `core/plugins/app/*`
2. `scanDiskModules()` 读各模块 meta → `syncModulesFromDisk()` 写 `sys_module`（INSERT 缺失行按 `defaultEnabled` 兜底 `enabled`，UPDATE 结构字段但**绝不动 enabled**）
3. 在 **root** 注册全局 `onRequest` gate：命中 `/api/<moduleId>/...` 且该模块 `enabled=false` → 直接 404；core 路由（`/api/v1/...`）放行
4. `mountAllOnDisk()`：用标准 `@fastify/autoload` 挂载**所有已打包模块**（不看 enabled），prefix = `moduleRoutePrefix(id)`
5. 注册 `core/routes/*`

> **为什么不做热挂载**：fastify 插件树 boot 后不可变，运行时无法 register/unregister 路由。旧实现的「热挂载」恒失败（`Root plugin has already booted`），且 unmount 的 `hasPlugin('module:<id>')` 反查永不命中。现改为「全挂载 + gate 拦截」，启停即时生效且不碰插件树。

启停缓存：`enabled` 集合有 redis 缓存（60s）+ 进程内 memo（5s）。toggle 写 DB 后调 `invalidateEnabledCache()` 同时清两级缓存，下一个请求即读到新值。

## 4. 开发者命令

```bash
# 构建期打包开关（改 module.json，需重新 build 生效）
pnpm --filter yishan-api modules:build <id> on     # 参与打包
pnpm --filter yishan-api modules:build <id> off    # 构建期排除，不进 dist

# 构建（自动按 module.json 生成 tsconfig.build.json 再编译）
pnpm --filter yishan-api build:ts

# 模块迁移（手动，程序从不自动跑）
npx drizzle-kit --config=src/modules/<id>/drizzle.config.ts generate
npx drizzle-kit --config=src/modules/<id>/drizzle.config.ts migrate
```

运行时启停：后台「模块控制」页 toggle，或 `POST /api/v1/admin/system/module-control/:id/toggle`（需 `system:module-control:toggle` 权限）。

## 4.5 安装期入驻（migrate → seed → 菜单追加）

> 这是与构建期 / 运行时并列的第三个时机——「把模块装进环境」。
> 入口：`pnpm --filter yishan-api db:seed:modules`
> 编排脚本：`apps/yishan-api/src/scripts/onboard-modules.ts`

对 `src/modules/` 下每个模块依次执行三步，**单步失败不阻断后续模块**（错误码 + 日志明确，便于一次跑完看全貌）：

| 步骤 | 行为 | 幂等性 |
| --- | --- | --- |
| 1. **迁移** | 调 `drizzle-kit migrate`（用模块自带的 `drizzle.config.ts/js`）；成功后把 `_journal.json` 的所有 tag 同步进 `sys_module_migration` | drizzle-kit 自身幂等；journal 同步按 hash 去重 |
| 2. **seed** | 执行模块的 seed 入口（`seed.ts` / `scripts/seed.ts` / `db/seed.ts` 之一，按源码路径映射到 `dist/` 同名 `.js`） | 取决于模块 seed 自身是否幂等；缺失则跳过 |
| 3. **菜单追加** | 读 `module.json` 的可选 `adminMenu` 声明 → INSERT `sys_menu`（**按 `path` 存在跳过**）→ 写 `sys_menu_permission` → 绑给 `super_admin` 与 `admin` 两个角色 → 写 `sys_role_permission` | path 由唯一索引保证；其余走 `onDuplicateKeyUpdate` |

> **菜单追加的存在跳过**：用 `sys_menu.path` 唯一索引 + 显式 `findMenuByPath` 双重判断——首跑 INSERT，重复跑 SELECT 后跳过，不报错。

### 4.5.1 `adminMenu` 声明格式（写在 `module.json`）

```jsonc
{
  "id": "demo",
  "build": true,
  "adminMenu": {
    "name": "模块演示",
    "path": "/demo/admin",
    "icon": "experiment",
    "component": "./demo/admin",        // umi 约定，对应 src/pages/<component>
    "parentPath": "/system",            // 可选；缺省挂到根
    "sortOrder": 50,
    "permission": {
      "code": "demo:admin:list",
      "label": "模块演示-查看",
      "group": "demo"
    }
  }
}
```

- 不声明 `adminMenu` → 步骤 3 直接跳过，模块「无管理入口」是合法状态（纯后端模块）。
- 前端组件由 `apps/yishan-admin/src/pages/<component>.tsx` 自带维护；编排脚本不强制存在。
- 权限码走 `registerPermissions(...)` 注册到 catalog，与路由模块顶层副作用相同机制；跑过一次后 `PERMISSION_CODES` 已含此码，重复注册会 throw（编排脚本已做 try 容错）。

### 4.5.2 使用流程

```bash
# 1. 装 core 系统数据（用户、角色、core 菜单、字典）
pnpm --filter yishan-api db:seed

# 2. 装模块（迁移 + 模块 seed + 追加模块菜单）
pnpm --filter yishan-api db:seed:modules
```

也可通过后台逐模块操作：`POST /api/v1/admin/system/module-control/:id/{migrate,seed}`（需对应权限码）。两入口等价，编排脚本只是批量化 + 增加菜单追加步骤。

## 5. 关键文件

| 关注点 | 文件 |
| --- | --- |
| prefix 单一源 / 挂载 / 缓存 | `apps/yishan-api/src/core/module-loader.ts`（`moduleRoutePrefix`、`mountAllOnDisk`、`enabledIdsCached`） |
| boot + gate | `apps/yishan-api/src/app.ts` |
| 构建期打包 | `apps/yishan-api/scripts/gen-module-tsconfig.mjs`、`scripts/module-build.mjs`、生成物 `tsconfig.build.json`（已 gitignore） |
| 安装期入驻 | `apps/yishan-api/src/scripts/onboard-modules.ts`（npm `db:seed:modules`） |
| 后台接口 | `apps/yishan-api/src/core/routes/api/v1/admin/system/module-control/{list,toggle,migrate,generate,seed}` |
| 后台前端 | `apps/yishan-admin/src/pages/system/module-control/index.tsx` |
| 表结构 | `sys_module`、`sys_module_migration`（`0001_sys_module.sql` / `src/db/schema/tables.ts`，**无 prefix 列**） |

## 6. 验证方式

```bash
# 构建期排除
pnpm --filter yishan-api modules:build demo off && pnpm --filter yishan-api build:ts
# → dist/modules/demo 不生成；modules:build demo on 后复原

# 安装期入驻
pnpm --filter yishan-api db:seed          # core 系统数据
pnpm --filter yishan-api db:seed:modules  # 模块 migrate/seed/菜单追加

# 运行时 gate（服务启动后）
curl /api/demo/v1/info          # enabled=1 → 200
# 后台停用 demo（无需重启）
curl /api/demo/v1/info          # → 404 {"code":40400,"message":"模块未启用：demo"}
curl /api/v1/auth/me            # core 路由不受影响 → 401
```

## 7. Swagger UI 约定

`core/plugins/external/swagger.ts` 注册 `@fastify/swagger` 时设了 `hideUntagged: true`——**没声明 tags 的路由不会出现在 `/api/docs`**。模块作者要让自己的路由被收集，必须满足：

| 必备项 | 写在路由的 `schema` 字段 |
| --- | --- |
| `tags: [<moduleId>]` | 集中常量 `ROUTE_TAG = '<moduleId>'` 写在模块的 `schemas/routes.schema.ts` |
| `summary` | 每个路由一句话说明 |
| TypeBox schema | body / params / response 至少给 response，否则只显示空壳 |
| `operationId` | 推荐写，便于客户端生成函数名 |

新模块加入 swagger 的两步：
1. 路由文件按上面四项配 `schema`（demo 5 个 route 是完整模板）
2. 在 `core/plugins/external/swagger.ts` 的 `openapi.tags` 数组里加 `{ name: '<moduleId>', description: '...' }`，否则 UI 只显示路由不显示 tag 分组标题

> 这是运行期 swagger UI（`/api/docs` 浏览器可见）的全部约定。`openapi.json` 自动重生不在本阶段范围内——`apps/yishan-api/openapi.json` 是手维护快照，admin SDK 仍按这份快照生成。
