# Contributing to Yishan

Thanks for your interest in contributing.

## Development Setup

Prerequisites:

- Node.js >= 20
- pnpm >= 8

Install dependencies at repo root:

```bash
pnpm install
```

## Common Commands

```bash
pnpm lint
pnpm test
pnpm build
pnpm arch:check
```

## Architecture Guardrails

This repository enforces architecture checks in CI. All pull requests must pass:

```bash
pnpm arch:check
```

Available sub-checks:

```bash
pnpm arch:check:routes
pnpm arch:check:manifest
pnpm arch:check:boundaries
```

Current enforced rules:

1. Plugin routes must use `routes/v1/<channel>` where channel is `admin|app|web|public`.
2. Legacy plugin route layout `routes/api/v1` is forbidden.
3. Each plugin with routes must provide `manifest.ts`.
4. Plugin `manifest.ts` must satisfy `scripts/arch/plugin-manifest.schema.json`.
5. `system` pages must not directly import plugin portal services unless explicitly allowlisted.

When a check fails, CI prints a rule ID, file path, reason, and fix hint.

Run apps individually:

```bash
pnpm --filter yishan-admin dev
pnpm --filter yishan-api dev
pnpm --filter yishan-docs start
```

## Pull Request Guidelines

1. Create a feature branch from `main`.
2. Keep changes focused and easy to review.
3. Add or update tests when behavior changes.
4. Run lint and tests before pushing.
5. Update related docs when needed.

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
