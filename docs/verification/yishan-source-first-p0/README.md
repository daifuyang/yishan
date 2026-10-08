# Yishan Source-First 重构 · P0 行为基线

执行日期 2026-10-08。依据：`docs/plans/yishan-source-first-architecture-review.md`（V2）§11 P0。

- **结论：PASS WITH WARNINGS；P1 准入 READY WITH RESTRICTIONS**（见 [p0-acceptance.md](p0-acceptance.md)）。
- 基线对象：`all@e4a08d3`（主要，V2 评审基线，当前 CD 来源）与 `main@6a5c62a`（对照）。
- 本次只新增测试与验证文档，未修改产品代码、SQL、journal、CI/CD、依赖或锁文件；数据库操作只在临时 Docker 容器内进行。

| 文档 | 内容 |
|---|---|
| [environment.md](environment.md) | P0-1 Git/工具链、包名与依赖、构建顺序、CI 现状、分支模块范围 |
| [build-results.md](build-results.md) | P0-2 每条检查命令的真实结果与失败归类 |
| [test-results.md](test-results.md) | 已有测试、集成测试、新增测试、启动探针、需人工验证项 |
| [api-contract.md](api-contract.md) | P0-3 OpenAPI 快照、对比方法、公开接口、信封与错误码、仓库 OpenAPI 漂移 |
| [module-baseline.md](module-baseline.md) | P0-4 模块生命周期 10 项 |
| [auth-baseline.md](auth-baseline.md) | P0-5 jwt-auth/rbac 依赖清单与认证权限行为 |
| [database-migration-audit.md](database-migration-audit.md) | P0-6 迁移风险逐项状态、复现场景、风险报告 |
| [risks.md](risks.md) | 全部发现，按严重程度排序 |
| [p0-acceptance.md](p0-acceptance.md) | 验收清单与 P1 准入结论 |

## 证据与脚本

```
evidence/
  openapi/   运行时 OpenAPI 快照（all/main × development/production，紧凑 JSON）
  contract/  逐操作契约表（TSV，可直接 diff）
  smoke/     启动探针结果（65 个探针 × 2 分支）
  db/        迁移复现场景日志（路径与临时密码已脱敏）
  checks/    检查命令汇总与集成测试错误摘录
scripts/
  run-checks.sh            逐条执行仓库已有检查命令并记录退出码
  api-baseline-probe.mjs   启动构建产物并记录行为探针 + 导出 OpenAPI
  p0-compare.mjs           openapi / smoke / contract 对比（有差异退出码 1）
  migration-repro.sh       迁移复现（只接受 label=purpose=yishan-p0-temp 的容器）
  db-inspect.cjs           只读检查：表、__drizzle_migrations（hash 反查来源）、sys_module(_migration)
  fileurl-require-shim.cjs 测试专用 preload，绕过 onboard 的 file:// require 以观察后续逻辑
```

## 复跑步骤（P1–P3 每阶段结束时）

```bash
# 0) Node 22.22.1 + pnpm 8.15.9
pnpm install --frozen-lockfile
pnpm --filter yishan-tiptap build && pnpm --filter yishan-api build:ts

# 1) 临时数据库（只用于验证，结束后删除）
docker run -d --name yishan-p0-mysql --label purpose=yishan-p0-temp -e MYSQL_ROOT_PASSWORD=<随机> -p 127.0.0.1:33796:3306 mysql:8.4
docker run -d --name yishan-p0-redis --label purpose=yishan-p0-temp -p 127.0.0.1:36796:6379 redis:7.4-alpine

# 2) 建立可用的 smoke 库：模块 SQL 先于 Core（规避 R-01），再 db:seed（需 shim 规避 R-02）
#    参考 migration-repro.sh 中 s4-modules-first 与 s2b-seed-shim 两个场景的步骤

# 3) 行为探针 + 对比
P0_PHASES=dev,pat,prod node docs/verification/yishan-source-first-p0/scripts/api-baseline-probe.mjs \
  apps/yishan-api mysql://root:<随机>@127.0.0.1:33796/<db> redis://127.0.0.1:36796/0 tmp/p1 p1
node docs/verification/yishan-source-first-p0/scripts/p0-compare.mjs smoke   docs/verification/yishan-source-first-p0/evidence/smoke/all-e4a08d3.json tmp/p1/smoke-p1.json
node docs/verification/yishan-source-first-p0/scripts/p0-compare.mjs openapi docs/verification/yishan-source-first-p0/evidence/openapi/all-e4a08d3-development.json tmp/p1/openapi-runtime-p1-development.json

# 4) 单测（含本次新增的两个基线测试）
pnpm --filter yishan-api test

# 5) 清理：docker rm -f yishan-p0-mysql yishan-p0-redis
```

Windows Git Bash 会把以 `/` 开头的参数改写为文件路径；`p0-compare.mjs openapi … --prefix` 可写成 `api/v1`。
