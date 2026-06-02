# Shop 迁移复核与最小修复清单

本文档基于当前迁移结果的快速复核，给出可直接执行的最小修复步骤，目标是先让 `shop` 插件达到“可生成 Prisma + 可编译 + 可启动联调”。

## 1. 当前结论

- 已完成的大方向是对的：`pluginId`、插件菜单路径、Admin 插件路由都已按新规范落地。
- 当前仍有 3 个阻塞项，导致还不能判定迁移完成。

---

## 2. 阻塞项与修复

## 2.1 Model 中 `dateUtils` 路径错误

### 现象

`shop` 模块 models 里引用了错误路径：`../../utils/date.js`，会导致找不到模块。

### 需要修改的文件

- `apps/yishan-api/src/plugins/modules/shop/models/shop-category.model.ts`
- `apps/yishan-api/src/plugins/modules/shop/models/shop-attribute.model.ts`
- `apps/yishan-api/src/plugins/modules/shop/models/shop-product.model.ts`
- `apps/yishan-api/src/plugins/modules/shop/models/shop-sku.model.ts`
- `apps/yishan-api/src/plugins/modules/shop/models/shop-order.model.ts`

### 修改方式

把：

```ts
import { dateUtils } from '../../utils/date.js'
```

改成：

```ts
import { dateUtils } from '../utils/date.js'
```

---

## 2.2 Shop Schema 未接入全局注册

### 现象

路由中使用了大量 `$ref`（如 `shopProductListQuery#`），但若未注册 `registerShopSchemas`，运行时会出现 schema 引用解析失败。

### 关键定位

- schema 注册函数：`apps/yishan-api/src/plugins/modules/shop/schemas/shop.ts`
- 外部 schema 入口代理：`apps/yishan-api/src/core/plugins/external/schemas.ts`
- 实际聚合入口通常是：`apps/yishan-api/src/core/schemas/index.ts`

### 修复目标

在全局 schema 聚合入口中引入并调用 `registerShopSchemas`，确保 Fastify 启动时注册 shop 的所有 schema。

### 参考样式（伪代码）

```ts
import registerShopSchemas from '../../plugins/modules/shop/schemas/shop.js'

export default async function schemas(fastify) {
  // ...已有 schema
  registerShopSchemas(fastify)
}
```

> 以你当前 `core/schemas/index.ts` 的实际写法为准，保持同风格接入。

---

## 2.3 Prisma Client 生成失败

### 现象

执行 `pnpm --filter yishan-api db:generate` 报错：

- `src/generated/prisma exists and is not empty but doesn't look like a generated Prisma Client`

### 处理建议

1. 先检查 `apps/yishan-api/prisma.config.ts` 与 `generator output` 是否一致。
2. 清理非 Prisma 生成物占用的目标目录后，再执行 generate。
3. 重新生成并确认 `src/generated/prisma/client.js` 存在。

> 注意：清理目录前先确认没有手写文件，避免误删。

---

## 3. 建议执行顺序（最小闭环）

1. 修正 5 个 model 的 `dateUtils` import。
2. 在 schema 聚合入口接入 `registerShopSchemas`。
3. 处理 Prisma 生成目录冲突，执行生成。
4. 再跑 API 编译验证。

---

## 4. 验证命令

在仓库根目录执行：

```bash
pnpm --filter yishan-api db:generate
pnpm --filter yishan-api build:ts
pnpm --filter yishan-admin exec node scripts/generate-plugin-routes.mjs
pnpm --filter yishan-admin lint
```

若前两条通过，说明后端迁移链路基本打通；后两条用于前端路由与静态检查收口。

---

## 5. 通过标准

满足以下条件即可认为本轮修复通过：

1. `db:generate` 成功，不再出现 generated 目录冲突。
2. `build:ts` 成功，无 `shop` 模块 import 或 Prisma 类型报错。
3. 启动后访问 `shop` 相关路由不再出现 schema `$ref` 未注册错误。
4. Admin 可访问 `/plugins/yishan/shop/*` 页面。
