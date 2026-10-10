# Contributing to Yishan

Thanks for your interest in contributing.

## Development Setup

Prerequisites：

- Node 与 pnpm 版本以 `.tool-versions` 和根 `package.json#packageManager` 为准

Install dependencies at repo root:

```bash
pnpm install
```

修改前请先阅读 [`CLAUDE.md`](../CLAUDE.md) 与 [模块接入指南](../apps/docs/content/modules/onboarding.md)。

## Common Commands

```bash
pnpm lint
pnpm test
pnpm build
```

## Quality Gate

提交前按改动范围运行对应 app 的 `lint`、`test` 与 `build`；根目录 `package.json` 列出了可用命令。

## Architecture Rules

API V2 通过 pnpm check:boundaries 和负面测试强制检查 Package exports、Core依赖方向、产品/模块私有边界。应用显式manifest决定安装，Core不扫描产品代码；System拥有sys_*，模块拥有<id>_表。Route → Service → Repository → Schema 保持分层。迁移必须保留发布历史，启动不迁移、不seed。

参见 [API V2](architecture/api-v2.md)、[包边界](architecture/package-boundaries.md)与[模块接入指南](../apps/docs/content/modules/onboarding.md)。

Run apps individually:

```bash
pnpm --filter @yishan/demo-admin dev
pnpm dev:api
pnpm --filter @yishan/docs start
```

## Pull Request Guidelines

1. 从本次工作的正确目标基线创建特性分支，先核对分支与工作区，不覆盖用户或其他 Worktree 修改。
2. 保持改动聚焦、便于 review。
3. 行为变更时同步新增或更新测试。
4. 推送前在本地跑完与改动范围对应的 `lint`、`test` 与 `build` 命令。
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

Do not open public issues for security vulnerabilities. Please follow [SECURITY.md](../SECURITY.md).
