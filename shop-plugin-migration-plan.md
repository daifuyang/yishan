# Shop 电商模块迁移计划（旧版 `Frontend/yishan` -> 新版 `products/yishan`）

## 1. 背景与目标

本文档用于指导将 Windows 旧仓库中的商城功能，迁移到当前新版仓库，并适配当前插件体系规范。

- **源仓库（旧版）**：`/mnt/c/workspace/Frontend/yishan`
- **目标仓库（新版）**：`/home/dfy/workspace/products/yishan`
- **迁移方式**：以“功能等价 + 新规范落地”为原则，不做大范围业务重构。

目标是把以下能力完整迁入：

- 商品分类（Category）
- 商品属性（Attribute / Value）
- 商品（Product）
- SKU（含属性组合）
- 订单（Order / Item）

---

## 2. 新版插件规范（迁移必须遵守）

基于当前仓库已有插件（如 `hello`、`portal`）总结的落地规范：

1. 后端插件目录：`apps/yishan-api/src/plugins/modules/<module>/`
2. 后端插件必须具备 `manifest.ts`，且包含：
   - `pluginId`：`org/plugin` 格式（例如 `yishan/shop`）
   - `name`：模块名（`shop`）
   - `menus`：路径必须以 `/plugins/<org>/<plugin>` 开头
   - `permissions`：插件权限点
3. 插件路由由 `app.ts` 自动挂载到：`/api/modules/<module>/...`
4. 前端插件 manifest 在：`apps/yishan-admin/src/plugins/modules/*.manifest.ts`
5. 构建前通过脚本生成插件路由：
   - `pnpm --filter yishan-admin exec node scripts/generate-plugin-routes.mjs`

注意：当前仓库 `manifest` 校验要求 `pluginId` 为 `org/plugin`（不是 `@org/plugin`）。

---

## 3. 源功能盘点（已确认）

### 3.1 后端源码位置（旧版）

`/mnt/c/workspace/Frontend/yishan/apps/yishan-api/src/plugins/modules/shop/`

已包含：

- `routes/v1/admin/{categories,attributes,products,skus,orders}/index.ts`
- `schemas/{common.ts,shop.ts}`
- `models/*.model.ts`
- `constants/{business-codes, messages}/shop.ts`
- `utils/{date.ts,response.ts}`
- `seed/index.ts`（旧菜单路径风格，不能直接照搬）

### 3.2 前端源码位置（旧版）

- 页面：`/mnt/c/workspace/Frontend/yishan/apps/yishan-admin/src/pages/shop/**`
- 服务：`/mnt/c/workspace/Frontend/yishan/apps/yishan-admin/src/services/yishan-admin/shop.ts`

### 3.3 数据模型（旧版）

- 文件：`/mnt/c/workspace/Frontend/yishan/apps/yishan-api/prisma/schema/shop.prisma`
- 关键表：
  - `shop_category`
  - `shop_attribute`
  - `shop_attribute_value`
  - `shop_product`
  - `shop_product_sku`
  - `shop_sku_attribute`
  - `shop_address`
  - `shop_cart`
  - `shop_order`
  - `shop_order_item`

---

## 4. 迁移范围与边界

### 4.1 本次迁移范围（建议）

- 管理端（Admin）电商管理全链路：分类/属性/商品/SKU/订单
- 后端插件 API 与 Prisma 模型
- 插件 manifest、菜单、权限、前端插件路由

### 4.2 明确不在本次范围

- C 端商城下单页面
- 支付网关与真实支付回调
- 库存并发扣减等高并发优化
- 大规模领域重构

---

## 5. 目录与文件落位设计（目标仓库）

### 5.1 后端

新增目录：

`apps/yishan-api/src/plugins/modules/shop/`

建议文件结构：

```text
apps/yishan-api/src/plugins/modules/shop/
├─ manifest.ts
├─ routes/v1/admin/
│  ├─ autohooks.ts
│  ├─ categories/index.ts
│  ├─ attributes/index.ts
│  ├─ products/index.ts
│  ├─ skus/index.ts
│  └─ orders/index.ts
├─ schemas/
│  ├─ common.ts
│  └─ shop.ts
├─ models/
│  ├─ shop-category.model.ts
│  ├─ shop-attribute.model.ts
│  ├─ shop-product.model.ts
│  ├─ shop-sku.model.ts
│  └─ shop-order.model.ts
├─ constants/
│  ├─ business-codes/shop.ts
│  └─ messages/shop.ts
└─ utils/
   ├─ date.ts
   └─ response.ts
```

### 5.2 前端

- 页面：`apps/yishan-admin/src/pages/shop/**`
- 服务：`apps/yishan-admin/src/services/yishan-admin/shop.ts`
- 插件 manifest：`apps/yishan-admin/src/plugins/modules/shop.manifest.ts`

### 5.3 Prisma

- 新增：`apps/yishan-api/prisma/schema/shop.prisma`

---

## 6. 关键规范改造点（从旧版到新版）

### 6.1 插件标识与菜单路径

旧版常见路径是 `/shop/*`，新版必须改为：

- `pluginId`: `yishan/shop`
- 菜单路径：`/plugins/yishan/shop/categories` 等

### 6.2 API 前缀

保持与当前运行时一致：

- 实际访问前缀：`/api/modules/shop/v1/admin/*`

说明：`module` 由目录名 `shop` 决定，`pluginId` 用于插件管理和菜单归属。

### 6.3 manifest 规范

后端 `manifest.ts` 至少包含：

- `pluginId: 'yishan/shop'`
- `name: 'shop'`
- `version`
- `coreCompatibility`
- `routeBase: '/api/modules/yishan/shop/v1'`（用于元数据展示）
- `permissions`
- `menus`（路径以 `/plugins/yishan/shop` 开头）

### 6.4 前端插件路由

`shop.manifest.ts` 中 routes 路径必须与菜单路径一致，且组件指向 `./shop/...`。

---

## 7. 详细实施步骤（可执行清单）

## 阶段 A：后端基础迁移

1. 创建 `shop` 插件目录与基础文件。
2. 拷贝旧版 `schemas/models/routes/constants/utils`。
3. 修正 import 风格、路径别名、ESM 后缀（与当前仓库一致）。
4. 确认 `autohooks.ts` 保留鉴权逻辑（`fastify.authenticate`）。

## 阶段 B：插件规范适配

1. 新建 `manifest.ts`，配置 `pluginId`、权限、菜单。
2. 将所有菜单路径从 `/shop/*` 改为 `/plugins/yishan/shop/*`。
3. route/schema 中 tags 与描述按现有风格统一。

## 阶段 C：数据模型迁移

1. 新增 `prisma/schema/shop.prisma`。
2. 核对与 `SysUser` 关系字段是否匹配（`userId`、外键策略）。
3. 执行：`pnpm --filter yishan-api db:generate`。
4. 修复 Prisma 类型报错直到通过。

## 阶段 D：前端迁移

1. 拷贝 `pages/shop/**`。
2. 拷贝 `services/yishan-admin/shop.ts`。
3. 创建 `src/plugins/modules/shop.manifest.ts`。
4. 执行插件路由生成脚本。

## 阶段 E：联调与回归

1. 启动 API 与 Admin。
2. 在插件管理页启用 `shop`，观察菜单同步。
3. 验证页面：分类、属性、商品、SKU、订单 CRUD/状态流。
4. 验证鉴权：无权限用户不可访问。

## 阶段 F：文档与交付

1. 新增模块文档（按 docs 模板）。
2. 记录迁移差异与已知限制。
3. 输出上线前检查清单。

---

## 8. 命令清单（迁移过程建议）

```bash
# 1) 生成 prisma client
pnpm --filter yishan-api db:generate

# 2) API 构建与测试
pnpm --filter yishan-api build:ts
pnpm --filter yishan-api test

# 3) 生成 Admin 插件路由
pnpm --filter yishan-admin exec node scripts/generate-plugin-routes.mjs

# 4) Admin 代码检查
pnpm --filter yishan-admin lint
```

---

## 9. 验收标准（DoD）

满足以下条件视为迁移完成：

1. `shop` 插件可被运行时扫描、注册并启用。
2. 插件菜单成功同步，路径为 `/plugins/yishan/shop/*`。
3. Admin 页面可正常访问：分类/属性/商品/SKU/订单。
4. 对应 API 可用，Schema 校验与返回结构正确。
5. Prisma Client 生成成功，API 构建与测试通过。
6. 禁用插件后菜单可隐藏，不影响 core 模块。

---

## 10. 风险与应对

### 风险 1：旧代码与新工程规范不一致

- 现象：import 风格、类型、路径别名报错
- 应对：先后端编译通过，再迁前端；逐文件修复，不做一次性大改

### 风险 2：Prisma 关系或索引冲突

- 现象：`db:generate` 报 relation/index 冲突
- 应对：优先保持表名与字段映射不变，仅微调 relation 命名与索引名

### 风险 3：菜单/权限无法联动

- 现象：启用插件后菜单不出现或权限点未生效
- 应对：检查 `manifest.menus`、`perm`、插件启用状态与 menu sync 日志

### 风险 4：前端路由未生成

- 现象：菜单点击 404
- 应对：重新执行 `generate-plugin-routes.mjs`，检查 `shop.manifest.ts` 路径是否重复或拼写错误

---

## 11. 建议迁移节奏（你自己执行时可按此分批）

- **第 1 批（后端可运行）**：A + B + C
- **第 2 批（前端可使用）**：D
- **第 3 批（质量收口）**：E + F

这样可以在每批次都有可验证成果，降低一次性迁移失败风险。

---

## 12. 迁移后建议补充

1. 为 `shop` 增加最小 API 测试（分类列表、商品创建、订单状态更新）。
2. 为插件管理页面补充 `shop` 同步日志验证用例。
3. 在 `apps/yishan-docs/docs/modules/` 下补 `shop.md`，固化权限点与接口入口。
