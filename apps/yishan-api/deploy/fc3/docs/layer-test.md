# FC3 Layer 验证

在 `apps/yishan-api` 下执行：

```bash
bash deploy/fc3/scripts/build-runtime-layer.sh
bash deploy/fc3/scripts/publish-runtime-layer.sh
bash deploy/fc3/scripts/pre-deploy-layered.sh
```

随后使用 `templates/function.yaml` 部署函数，并检查函数日志中 Node 运行时、`/opt/nodejs/node_modules` Layer 路径和 `/api/health`。依赖变化后必须重新发布 Layer；`layer-lock.json` 的 fingerprint 必须与 `config/layer-dependencies.json` 匹配。
