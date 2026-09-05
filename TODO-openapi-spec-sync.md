# TODO: OpenAPI spec 同步自动化

**状态**：🟡 进行中（2026-09-05 起，dump-openapi 脚本已落地，CI hook 待补）

## 背景

2026-09-05 用 restish 端到端验证 CRM 重构时发现：

| | committed openapi.json | live /api/docs/json | 差距 |
|---|---|---|---|
| 总 paths | 71 | 120 | **-49** |
| CRM | 0 | 24 | **-24** |
| shop | 0 | 12 | **-12** |
| portal | 0 | 11 | **-11** |
| demo | 3 | 3 | 0 |

committed 文件严重落后 live spec，导致：
- restish / openapi-generator / Stoplight 等 spec-aware 客户端看不见模块端点
- 前端 `pnpm --filter yishan-admin openapi` 拿不到 CRM/shop/portal 类型（admin 端是手写 `services/crm.ts` 临时绕过）

## 已完成

- ✅ `apps/yishan-api/scripts/dump-openapi.mjs` — 从运行中 API 拉 spec 写到仓库
- ✅ `apps/yishan-api/package.json` 增加 `openapi:dump` 脚本
- ✅ 一次性 refresh：`apps/yishan-api/openapi.json` 已更新到 120 paths / 274 KiB

## 待完成

### 1. CI hook：防止 spec 再次漂移

候选方案（按推荐度排序）：

**A. GitHub Actions 烟雾测试 + PR check**
```yaml
- name: Verify OpenAPI spec is in sync
  run: |
    pnpm --filter yishan-api dev &
    sleep 15  # 等 fastify 起来
    pnpm --filter yishan-api openapi:dump
    if ! git diff --quiet apps/yishan-api/openapi.json; then
      echo "openapi.json 已漂移，请重新跑 dump 并提交"
      exit 1
    fi
```

**B. 简单的 drift 检测脚本**
`scripts/check-openapi-drift.mjs`：拉 live spec，对比 git HEAD 的 openapi.json，有 diff 就 fail。

**C. 启动时自动 dump**
`apps/yishan-api/src/app.ts` 在 `fastify.swagger()` 注册后 hook 一个 `onReady`，自动写 spec。简单但把生成物混进 runtime，**不推荐**。

### 2. 前端 openapi 客户端 regenerator

把 CRM 服务从手写 `services/crm.ts` 切到 `services/generated/crm.ts`：
- 跑 `pnpm --filter yishan-api openapi:dump` 刷新 spec
- 跑 `pnpm --filter yishan-admin openapi` 用 Umi Max 的 `max openapi` 生成 TS
- 把 `apps/yishan-admin/src/services/crm.ts` 改为 re-export generated 模块（向后兼容）
- 这步依赖 #1，否则下次 `pnpm openapi` 会把陈旧类型再带回来

### 3. 把 dump-openapi 接到 dev workflow

`apps/yishan-api/package.json` 的 `dev` script 可以加：
```json
"dev:sync-openapi": "concurrently -k -p \"[{name}]\" -n \"TS,API,Dump\" ... \"node scripts/dump-openapi.mjs --watch\""
```
但 watch 模式要加轮询，复杂度 > 收益。**不做**。

## 风险

- **dump 时机**：必须在所有 route 注册完（包括 `@fastify/autoload` 的模块路由）后才能拿到完整 spec。fastify 的 `onReady` hook 是触发点，dump-openapi 脚本只负责 HTTP GET，不参与 boot 时机。
- **格式选择**：目前保持单行紧凑 JSON（与历史一致），diff 友好。如果未来切到 pretty-print，需要重写 committed 文件 + 更新 PR 校验脚本。
- **CRM 安全声明**：经 dump 后所有 41 个 CRM operation 都带 `security: [{ bearerAuth: [] }]`（由 `apps/yishan-api/src/app.ts:98` 的 `onRoute` hook 自动注入）。CRM 没有 `TODO-openapi-module-security.md` 里描述的 bug——那是 demo/portal/shop 旧状态，已经修复。

## 关联

- `apps/yishan-api/src/app.ts:90-106` — onRoute hook 自动注入 security
- `apps/yishan-api/scripts/dump-openapi.mjs` — dump 脚本
- `apps/yishan-api/openapi.json` — 已更新到 120 paths
- `FIX-api-validation-2026-07-24.md` — 上次 restish 验证发现
- `TODO-openapi-module-security.md` — 同类问题（已修复）

## 备注

如果只想做最小修复，**只做第 1 项的方案 A**（一个 GitHub Actions job）就足以防止再次漂移。其他都是增量改进。
