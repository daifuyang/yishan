> **已下线（2026-10-21）**：本目录是阿里云 FC 的打包材料，配套的发布工作流已从
> `.github/workflows/` 移出，仅作参考保留，见 [`../fc-example/README.md`](../fc-example/README.md)。
> 同账号上只有 `yishan-crm` 函数仍在运行，其余 yishan FC 函数已删除。本目录对 CRM 仍有用处。

FC3 deployment

The function ships a complete pnpm production dependency closure, including all compiled Core packages. It does not require a runtime Layer or copy source paths from the workspace.

Build the Admin SPA from the repository root with `PUBLIC_PATH=/admin/ pnpm build:admin` (PowerShell: `$env:PUBLIC_PATH='/admin/'; pnpm build:admin`). The artifact comes from `apps/demo/admin/dist`, and `PUBLIC_PATH` must match the API's `ADMIN_BASE_PATH`. Then run from `apps/demo/api`:

```sh
bash deploy/fc3/scripts/pre-deploy.sh
bash deploy/fc3/scripts/deploy-function.sh
```

`pre-deploy.sh` builds the API dependency graph, calls `scripts/package-api.mjs`, verifies exported JavaScript/declarations and runtime resources, and checks a standalone Core startup. The function starts `node dist/main.js`; Admin files are placed in `public/admin`. The build does not generate or apply migrations.

The installed business modules come only from `src/manifest.ts`. Uninstalled module output, including CRM by default, is removed from the function package while its source remains available for development. Core packages and their public exports resolve entirely inside the artifact.

CI verifies the same production package in a directory outside the repository. Deployment uses the existing OIDC `default` Serverless Devs profile. Domain configuration remains in `templates/domain.yaml`; runtime settings are described in [environment variables](docs/environment-variables.md).

The `yishan-api-cd.yml` workflow deploys this function on pushes to `main` that touch the API paths. Its default gate requires successful CI for the same commit, and pending migrations run before the deploy: a failed migration blocks it. Manual `workflow_dispatch` runs can bypass the gate with `skip_ci_gate` or the migration step with `skip_migrations`.

Database migrations also remain available on demand through the manual `yishan-fc-migrate.yml` SSH tunnel workflow, which supports read-only `dry-run` or confirmed `apply`. The obsolete FC migration runner and Layer packaging scripts have been removed. Production reset is not exposed.
