# P1-A1 main 既有验证失败的处理

分支：`refactor/source-first-p1a`，起点 `main@6a5c62a`，独立 worktree `.claude/worktrees/source-first-p1a`。Node 22.22.1 / pnpm 8.15.9（`pnpm check:toolchain` 通过）。

## 1. 修复前复核（与 P0 一致）

`docs/verification/yishan-source-first-p0/scripts/run-checks.sh`，日志 `tmp/p1a/logs/before/`（未提交）：

| 检查 | 退出码 | 结果 |
|---|---|---|
| `pnpm --filter yishan-api test` | 1 | 1 file / 5 tests 失败（`src/modules/demo/tests/system-menu.test.ts`） |
| `pnpm --filter yishan-admin lint` | 1 | Biome 2 errors（`lint/a11y/useMediaCaption`，`src/pages/system/attachments/index.tsx:328,330`） |
| `pnpm --filter yishan-app lint` | 2 | `tsc` 44 errors |
| `pnpm --filter yishan-tiptap build` | 0 | 8 条 TS 诊断仅作为 Rollup 告警 |
| `pnpm lint` / `pnpm test` | 1 / 1 | 分别停在 admin lint、API test |
| 其余（tiptap/admin/api/app/docs 构建、admin test、docs typecheck、module naming） | 0 | 通过 |

## 2. 分类与处理

| 问题 | 分类 | 处理 | 是否改变行为 |
|---|---|---|---|
| demo `system-menu` 5 个失败 | **测试断言过期**：`config/system-menu.json` 在 `ed47d5c` 新增 `/demo/region` 页面（按钮绑定 Core 的 4 个 `region:*` 权限），测试仍按旧快照断言 10 个节点 | 更新为当前配置的**精确**数值（12 节点 / 4 页面 / 7 按钮 / 4 个默认动作）；`demo:` 前缀规则对 demo 自有页面保持严格，region 页单独断言其 4 个 Core 权限码。未采用 all 的 `3f5980f`（把 `toBe` 改成 `toBeGreaterThanOrEqual`，放宽了断言） | 否（只改测试） |
| Admin Biome 2 errors | **工具规则与真实场景冲突**：附件预览播放任意用户上传的音视频，系统不存储字幕轨 | 两处加针对性的 `biome-ignore lint/a11y/useMediaCaption: <原因>`。未采用 all 的做法（插入无 `src` 的空 `<track>`，只为满足规则） | 否 |
| TipTap TS7030 × 4 | **既有技术债（可安全修复）** | `use-color-text.ts`、`use-color-highlight.ts` 在 `setTimeout` 后补 `return undefined;`；`color-highlight-popover.tsx` 中 `onSelect`（类型为 `void`）的守卫由 `return false` 改为 `return`。返回值无调用方使用（子代理逐一核对） | 否 |
| TipTap TS2769 × 2、TS2339 × 2 | **依赖问题**：同时安装 `@tiptap/core` 3.11.0（starter-kit 的普通依赖）与 3.28.0（其余包的 peer），扩展的类型增强落在另一份 core 上 | 未修复（需改依赖与锁文件，会改变打包产物）。记录在 `scripts/baselines/tsc/tiptap.json`，见 known-issues N-02 | — |
| App `tsc` 44 errors | **实际产品缺陷**：`d163a32` 按不存在的组件/接口形态重写 `pages/system/user/edit`，页面无输入控件、加载与保存结果判断错误 | 未修复（属于 UI 功能修改）。记录在 `scripts/baselines/tsc/app.json`，见 known-issues N-01 | — |
| TipTap 构建不传播 TS 错误 | **工具配置**：`@rollup/plugin-typescript` 默认 `noEmitOnError: false` | 未改 Rollup 配置（开启后会因 N-02 立刻失败）；以 `typecheck:baseline` 在 lint/CI 中拦截新错误 | — |

### 未把遗留错误伪装成已解决

- `pnpm --filter yishan-app lint`（Biome + 原始 `tsc`）**仍然失败**，退出码 2，未修改该脚本。
- 根 `pnpm lint` 改为调用 `pnpm --filter yishan-app biome:lint` + `node scripts/check-tsc-baseline.mjs app`：已记录的 44 个错误不再阻断，但**任何新增错误、或已修复却仍留在基线中的错误都会失败**（负向验证见 ci-validation.md §3）。tsc 本身异常退出且无法解析诊断时同样失败。

## 3. 从 P0 迁移的测试

`apps/yishan-api/test/module-lifecycle.baseline.test.ts`（6）与 `auth.jwt-session.baseline.test.ts`（7）原写于 all。它们覆盖的源文件（`module-loader.ts`、`jwt-auth.ts`、`error-handler.ts`、`business-codes/{index,auth,user}.ts`）在 main 与 all 之间 `git diff` 为空，因此原样迁移，在 main 上 13/13 通过。

## 4. 修复后

| 检查 | 修复前 | 修复后 |
|---|---|---|
| API 单元测试 | 29 passed / 1 failed / 3 skipped files；289 / **5 failed** / 20 skipped | **33 passed / 5 skipped files；313 passed / 30 skipped**（新增 demo 断言 1、migration-plan 5、P0 迁移 13；跳过的为 5 个集成文件） |
| Admin Biome | 2 errors | 0 errors（27 warnings、1 info 为既有项） |
| TipTap `tsc` | 8 errors | 4 errors（已记录基线） |
| App `tsc` | 44 errors | 44 errors（已记录基线，KNOWN BASELINE FAILURE） |
