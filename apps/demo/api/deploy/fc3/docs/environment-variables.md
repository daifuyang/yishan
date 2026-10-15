# FC3 环境变量

GitHub Environment `YISHAN_API` 保存非敏感部署变量：`FUNCTION_REGION`、`FUNCTION_NAME`、`FUNCTION_DESCRIPTION`、`FUNCTION_VPC_ID`、`FUNCTION_VSWITCH_ID`、`FUNCTION_SECURITY_GROUP`、`CUSTOM_DOMAIN`、`CERT_NAME`、`CACHE_NAMESPACE` 和 `TRUST_PROXY_IPS`。

数据库、Redis、JWT、管理员密码及云访问凭据必须保存为 GitHub Secrets。迁移工作流通过 SSH 隧道使用同一组应用数据库凭据；每个部署单元必须使用独立数据库和数据库账号。

FC3 模板设置 `PORT=3000`，与 `customRuntimeConfig.port` 保持一致。Demo 本地默认端口为 3100；使用 Docker 或其他平台部署时应显式设置 `PORT` 并映射相同端口。

`TRUST_PROXY_IPS` 是逗号分隔的可信代理 IP 或 CIDR 列表，默认为空，即忽略转发头，使用连接对端 IP。有多层代理时，只加入已核实的代理地址或网段；Fastify 从连接对端向前检查 `X-Forwarded-For`，在首个未信任地址停止。禁止使用 `true`、跳数或全网 CIDR，也不要直接信任所有内网。该配置影响登录日志、最近登录 IP、审计以及按 IP 限流；已有日志不会回填。

2026-10-15（北京时间）使用隔离的 FC3 `custom.debian12` HTTP 函数实测：连接对端为 `21.0.0.1`，FC 将实际客户端地址追加到 `X-Forwarded-For` 最右端；客户端伪造单个或多个 XFF 前缀时，最右端仍是实际客户端地址。`X-Real-IP` 原样透传，不能作为可信来源。当前 Demo FC 部署应显式设置 `TRUST_PROXY_IPS=21.0.0.1`，仅信任该单个代理；模板默认值仍为空。变更运行时、入口域名或代理链后，重新核对连接对端和 XFF 追加行为，不能直接沿用其他环境的地址或扩大为整段网段。

`YISHAN_API_REDIS_URL` Secret 原样传给函数的 `REDIS_URL`，优先于主机、端口等分项配置。使用 `rediss://` 时 System 保留 TLS 设置，不能只传解析后的 `REDIS_HOST` / `REDIS_PORT`。`CACHE_NAMESPACE` 默认 `yishan:demo`，其他产品或共享 Redis 的独立部署应配置不同命名空间。
