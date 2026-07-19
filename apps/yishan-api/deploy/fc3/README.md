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
