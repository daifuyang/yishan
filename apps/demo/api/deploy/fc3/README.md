# FC3 deployment

The function ships a complete pnpm production dependency closure, including all compiled Core packages. It does not require a runtime Layer or copy source paths from the workspace.

After building the Admin SPA, run from `apps/demo/api`:

```sh
bash deploy/fc3/scripts/pre-deploy.sh
bash deploy/fc3/scripts/deploy-function.sh
```

`pre-deploy.sh` builds the API dependency graph, calls `scripts/package-api.mjs`, verifies exported JavaScript/declarations and runtime resources, and checks a standalone Core startup. The function starts `node dist/main.js`; Admin files are placed in `public/admin`. The build does not generate or apply migrations.

The installed business modules come only from `src/manifest.ts`. Uninstalled module output, including CRM by default, is removed from the function package while its source remains available for development. Core packages and their public exports resolve entirely inside the artifact.

CI verifies the same production package in a directory outside the repository. Deployment uses the existing OIDC `default` Serverless Devs profile. Domain configuration remains in `templates/domain.yaml`; runtime settings are described in [environment variables](docs/environment-variables.md).

The `yishan-fullstack-cd-fc.yml` workflow deploys only after manual `workflow_dispatch`; pushes do not release production. Its default gate requires successful CI for the selected commit. The existing explicit emergency `skip_ci_gate` input remains available for manual use.

Database migrations run separately through the manual `yishan-fc-migrate.yml` SSH tunnel workflow. It builds the explicit application migration plan and supports read-only `dry-run` or confirmed `apply`. The obsolete FC migration runner and Layer packaging scripts have been removed. Production reset is not exposed.
