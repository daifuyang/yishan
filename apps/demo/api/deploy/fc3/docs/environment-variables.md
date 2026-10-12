# FC3 环境变量

GitHub Environment `YISHAN_API` 保存非敏感部署变量：`FUNCTION_REGION`、`FUNCTION_NAME`、`FUNCTION_DESCRIPTION`、`FUNCTION_VPC_ID`、`FUNCTION_VSWITCH_ID`、`FUNCTION_SECURITY_GROUP`、`CUSTOM_DOMAIN`、`CERT_NAME` 和 `CACHE_NAMESPACE`。

数据库、Redis、JWT、管理员密码及云访问凭据必须保存为 GitHub Secrets。迁移工作流通过 SSH 隧道使用同一组应用数据库凭据；每个部署单元必须使用独立数据库和数据库账号。

FC3 模板设置 `PORT=3000`，与 `customRuntimeConfig.port` 保持一致。Demo 本地默认端口为 3100；使用 Docker 或其他平台部署时应显式设置 `PORT` 并映射相同端口。

`YISHAN_API_REDIS_URL` Secret 原样传给函数的 `REDIS_URL`，优先于主机、端口等分项配置。使用 `rediss://` 时 System 保留 TLS 设置，不能只传解析后的 `REDIS_HOST` / `REDIS_PORT`。`CACHE_NAMESPACE` 默认 `yishan:demo`，其他产品或共享 Redis 的独立部署应配置不同命名空间。
