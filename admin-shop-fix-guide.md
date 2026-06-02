# Admin 端 Shop 模块修复指南（当前状态）

本文档说明当前 `shop` 迁移后，为什么 `yishan-admin` 还未通过，以及你可以按什么顺序修复。

## 当前结论

- `yishan-api` 已通过编译：`pnpm --filter yishan-api build:ts`。
- `yishan-admin` 仍失败：`pnpm --filter yishan-admin lint`。

失败根因主要在 **Admin 服务与 OpenAPI 生成类型不一致**，另外有一个核心文件被误删。

---

## 1. 必修复项

## 1.1 恢复被删除文件

当前 `git status` 显示：

- `D apps/yishan-admin/src/services/yishan-admin/sysPlugins.ts`

这会导致 `src/pages/system/plugins/index.tsx` 无法正常引用。

### 处理

恢复该文件到删除前状态（从 git 历史或你本地备份恢复均可）。

---

## 1.2 统一 Shop service 与 API 类型来源

当前 `apps/yishan-admin/src/services/yishan-admin/shop.ts` 大量使用 `API.shop*` 类型（例如 `API.shopProductListResp`），但编译提示这些类型不存在。

这说明：

- 你手写的类型命名 与 当前 OpenAPI 生成类型命名 不一致。

### 推荐处理（优先）

1. 先保证 API 服务启动且 shop 路由可在 `/api/docs/json` 中看到。
2. 运行 OpenAPI 生成：

```bash
pnpm --filter yishan-admin openapi
```

3. 查看 `apps/yishan-admin/src/services/yishan-admin/` 下是否生成了 shop 对应的 service（或落在已有文件中）。
4. 让页面层改为引用“生成后的 service 与类型”，不要坚持旧命名。

> 目标是“跟随生成结果”，而不是强行保留 `shop*` 命名。

---

## 1.3 页面层类型引用同步

当前报错文件包括：

- `apps/yishan-admin/src/pages/shop/attributes/**`
- `apps/yishan-admin/src/pages/shop/categories/**`
- `apps/yishan-admin/src/pages/shop/products/**`
- `apps/yishan-admin/src/pages/shop/skus/**`
- `apps/yishan-admin/src/pages/shop/orders/**`

典型错误：

- `Namespace 'API' has no exported member 'shopProduct'`
- `Namespace 'API' has no exported member 'shopCategory'`

### 处理

- 把这些类型替换成 openapi 生成后的实际类型名。
- 或临时用更宽松的局部类型兜底，先通过编译，再逐步精化。

---

## 2. 次要收口项（非主阻塞）

## 2.1 Lint warning

- `apps/yishan-admin/src/pages/shop/categories/index.tsx`
  - `TreeSelect` 未使用，删除无用 import。

## 2.2 implicit any

典型位置：

- `apps/yishan-admin/src/pages/shop/attributes/index.tsx`
- `apps/yishan-admin/src/pages/shop/orders/index.tsx`
- `apps/yishan-admin/src/pages/shop/skus/index.tsx`

给回调参数补类型，或由上游数据类型推断。

---

## 3. 推荐修复顺序

1. 恢复 `sysPlugins.ts`。
2. 确认 API 文档包含 shop 路由。
3. 执行 `pnpm --filter yishan-admin openapi`。
4. 用生成结果回填 `shop.ts`（或替换为生成 service 调用）。
5. 调整各 shop 页面类型引用。
6. 处理 lint/any 小问题。
7. 最终验证。

---

## 4. 验证命令

按顺序执行：

```bash
pnpm --filter yishan-api build:ts
pnpm --filter yishan-admin openapi
pnpm --filter yishan-admin exec node scripts/generate-plugin-routes.mjs
pnpm --filter yishan-admin lint
```

期望结果：

- `build:ts` 成功
- `openapi` 成功生成
- `plugin-routes` 生成成功
- `lint` 无 error（warning 可按规范继续收口）

---

## 5. 完成标准（DoD）

满足以下即认为 Admin 侧修复完成：

1. `sysPlugins.ts` 恢复且系统插件页可编译。
2. `shop.ts` 不再引用不存在的 `API.shop*` 类型。
3. `pages/shop/**` 不再出现 `API.shop*` 缺失错误。
4. `pnpm --filter yishan-admin lint` 通过。
