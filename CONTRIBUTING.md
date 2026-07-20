# Contributing to Yishan

Thanks for your interest in contributing.

## Development Setup

Prerequisites：

- Node 与 pnpm 版本以 `.tool-versions` 和根 `package.json#packageManager` 为准

Install dependencies at repo root:

```bash
pnpm install
```

修改前请先阅读根目录的 `AGENTS.md`、`ARCHITECTURE.md`、`PLUGIN_CONTRACT.md`、`RELEASE_CONTRACT.md`。

## Common Commands

```bash
pnpm lint
pnpm test
pnpm build
pnpm verify -- --profile core
```

## Quality Gate

提交前必须在本地通过 profile 化的质量门禁：

```bash
pnpm verify -- --profile core
```

该命令覆盖 arch 检查、Drizzle 生成、OpenAPI 生成、Admin route 生成、API build/test、Admin lint/test/build、App lint/build、Docs build 与生成物 diff 检查。详细步骤与子命令见 `AGENTS.md` §5。

## Architecture Guardrails

仓库在 CI 强制执行架构检查；所有 PR 必须通过：

```bash
pnpm verify -- --profile core
```

当前强制的规则：

1. 插件只能有一份 `plugins/<vendor>/<slug>/plugin.ts` manifest，禁止双 manifest。
2. 插件目录命名与 API 前缀必须由 `id = <vendor>/<slug>` 派生，不得硬编码具体业务插件。
3. Route 不得直接访问 DB；Repository 是唯一允许 import Drizzle 表与 SQL 的层。
4. Core 不得 import 插件；插件不得跨插件 import。
5. OpenAPI spec 与 Admin client 由 profile 驱动，跨 profile 残留物必须零命中。

更多规则与决策依据见 `specs/baseline-v2/decisions/`。

Run apps individually:

```bash
pnpm --filter yishan-admin dev
pnpm --filter yishan-api dev
pnpm --filter yishan-docs start
```

## Pull Request Guidelines

1. 从 `main` 创建特性分支。
2. 保持改动聚焦、便于 review。
3. 行为变更时同步新增或更新测试。
4. 推送前在本地跑通对应改动范围的 verify 命令（参考 `AGENTS.md` §7）。
5. 涉及架构、根规范、profile 的改动需同步更新根目录文档。

## Commit Message

Please follow Conventional Commits when possible:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code refactor without behavior change
- `test:` test updates
- `chore:` tooling or maintenance

## Security

Do not open public issues for security vulnerabilities. Please report via `SECURITY.md`.