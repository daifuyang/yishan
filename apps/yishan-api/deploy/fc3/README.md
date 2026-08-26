# FC3 部署目录

部署模板在 `templates/`，构建与发布脚本在 `scripts/`，静态 Layer 与 runner 配置在 `config/`。本地构建产物、Layer lock 与证书均不提交。

在 `apps/yishan-api` 下执行：

```bash
bash deploy/fc3/scripts/build-runtime-layer.sh
bash deploy/fc3/scripts/publish-runtime-layer.sh
bash deploy/fc3/scripts/pre-deploy-layered.sh
s deploy -y -t deploy/fc3/templates/function.yaml
```

迁移 Runner 使用 `scripts/prepare-migration-runner.sh` 与 `templates/runner.yaml`；自定义域名使用 `templates/domain.yaml`。变量和 Secrets 边界见 [环境变量说明](docs/environment-variables.md)。

## 凭证：OIDC（推荐）vs 写死 AK

`yishan-fullstack-cd-fc.yml` 与 `yishan-fc-migrate.yml` 默认走 **OIDC**：job 声明 `permissions: id-token: write`，在 workflow 里用 `aliyun sts AssumeRoleWithOIDC` 换取 1 小时有效的 STS 凭证，写入 `~/.s/access.yaml` 的 `default` profile。因此：

- `templates/{function,domain,runner}.yaml` 的 `access` 字段是 `default`（对应 OIDC STS profile 名）。
- `publish-runtime-layer.sh` 通过 `YISHAN_FC_ACCESS_ALIAS=default` 覆盖其默认的 `enterprise`。
- 需要 GitHub Secret `FC_DEPLOY_ROLE_ARN`（共享 RAM Role `GithubActionsFcDeployer`，trust policy 只校验 `oidc:iss`，天然覆盖本仓库）。

`yishan-cert-rotate-fc.yml` 仍用写死 AK（`ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET` + `-a enterprise`）：OIDC role 策略只有 `fc:* + vpc:Describe*`，没有 `dns:*`/`cas:*`，证书轮换需要 DNS/CAS 权限，故保留长期 AK。
