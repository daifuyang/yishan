# Contributing to Yishan

Thanks for your interest in contributing.

## Development Setup

Prerequisites：

- Node 与 pnpm 版本以 `.tool-versions` 和根 `package.json#packageManager` 为准

Install dependencies at repo root:

```bash
pnpm install
```

修改前请先阅读根目录的 `AGENTS.md`、`ARCHITECTURE.md`。

## Common Commands

```bash
pnpm lint
pnpm test
pnpm build
```

## Quality Gate

提交前按 `AGENTS.md` §7 跑完对应改动范围的 app `lint/test/build`。

## Architecture Rules

仓库当前强制执行的架构规则（不在 CI 自动检查，依赖开发者自觉）：

1. 模块只能有一份 `apps/yishan-api/src/modules/<id>/routes.ts`，禁止多 manifest。
2. 模块前缀由 `meta.prefix` 派生，不得硬编码具体业务命名空间。
3. Route 不得直接访问 DB；Repository 是唯一允许 import Drizzle 表与 SQL 的层。
4. Core 不得 import 模块源码；模块不得跨模块 import。

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
4. 推送前在本地跑完 `AGENTS.md` §7 对应范围的命令。
5. 涉及架构、根规范的改动需同步更新根目录文档。

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
