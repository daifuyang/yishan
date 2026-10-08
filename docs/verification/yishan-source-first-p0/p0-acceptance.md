# P0 验收

## 总体结果：**PASS WITH WARNINGS**

基线本身可信：所有能在本机执行的检查都已实际运行并记录真实退出码；API 契约、模块生命周期、认证权限、数据库迁移都有可复跑的证据与脚本。警告来自基线中发现的**现有**问题（risks.md），它们阻止 P4，但不阻止在限定范围内开始 P1。未达到 PASS 的原因：根 `pnpm lint` 在两分支失败、main 的 `pnpm test` 失败、已提交 OpenAPI 与运行时不一致、已部署数据库状态未核对。

## 验收清单

| 项 | 结果 | 说明 |
|---|---|---|
| 记录 Git 分支、HEAD 和工作区状态 | ✅ | environment.md §1。共享 checkout 的未提交内容因会话隔离未盘点，已列为人工项 |
| 现有构建和测试结果有真实记录 | ✅ | build-results.md、test-results.md、`evidence/checks/` |
| API 基线已保存 | ✅ | 4 份运行时 OpenAPI + 契约 TSV + 65 个行为探针 × 2 分支 |
| 模块生命周期已测试 | ✅ | 10 项中 API 侧 10 项通过；Admin 侧“删除模块后构建”未验证 |
| 身份认证与权限行为有测试基线 | ✅ | 已有 9 个测试文件 + 新增 JWT 会话单测 + 启动探针 |
| 数据库迁移风险已实际验证或列出未验证原因 | ✅ | M1–M5、M7、M8、O1、J1、J3 在隔离库复现；M6/M9/M10/J2 源码确认；已部署库未核对（无只读凭据，按要求不连接） |
| main/all 差异和部署风险已记录 | ✅ | environment.md §5–6、api-contract.md §3/§6、risks.md R-03/R-08/R-10 |
| 没有修改现有业务逻辑 | ✅ | `git status` 仅新增 2 个测试文件与本目录 |
| 没有修改任何真实数据库 | ✅ | 只使用标签为 `purpose=yishan-p0-temp` 的临时容器；未连接 `mysql-local` 或任何远程库 |
| 没有修改生产部署配置 | ✅ | `.github/`、`deploy/`、`dockerfile` 未改动 |
| 没有覆盖现有未提交代码 | ✅ | 未对共享 checkout 与其他 worktree 执行任何写操作；`main` 通过 `git archive` 导出 |
| 验证报告可以支持 P1–P3 的兼容性比较 | ✅ | `scripts/p0-compare.mjs`（openapi / smoke / contract 三种模式）+ 本目录快照 |

## P1 准入：**READY WITH RESTRICTIONS**

限制：
1. **不触碰迁移机制与任何 SQL/journal**（R-01、R-02、R-06、R-07 属于 P4，需人工确认）。
2. **P1 的契约基准使用本目录的运行时快照**，不要使用仓库里已提交的 `openapi.json`（R-03、R-10）。
3. **先确定 P1 的目标分支**：V2 建议以 main 为唯一开发分支，但 main 自身基线不绿（R-10）。以 main 为目标时，先修复或明确白名单化 main 的 5 个 API 测试失败与 2 个 Biome 错误；以 all 为目标时，所有改动仍需最终回迁 main。
4. 根 `pnpm lint` 的 App `tsc` 失败（R-09）要么在 P1 前修复，要么作为已知失败写进 P1 的验收白名单，不能让它掩盖新的失败。
5. P1 中预期会改变探针/契约的项（PAT 分组修复 R-04、Swagger tags R-17、`meta.id` 校验 R-16、app/auth security 标注 R-13）必须在 P1 报告中逐项列为“允许差异”，其余探针与契约必须零差异。
