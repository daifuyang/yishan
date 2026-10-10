# @yishan/demo-config

Demo 产品配置，供 Demo Admin 和配套小程序共用。源码包，无构建步骤；Core 不依赖本包。

当前只提供 `resolveApiTarget(defaultTarget, env?)`，用于确定本地开发时 `/api`、`/uploads` 代理到哪个 API 地址。默认地址由调用方传入，本包不内置。

## 覆盖优先级

1. `API_TARGET`：完整地址
2. `YISHAN_API_TARGET`：完整地址
3. `YISHAN_API_PORT`：只替换默认地址的端口，协议、主机和路径保持不变；必须是 1–65535 的整数，否则启动时报错
4. 调用方传入的默认地址

## 使用示例

调用方（Admin 的 `config/proxy.ts`，小程序的 `config/index.ts`、`config/dev.ts` 同理）：

```ts
import { resolveApiTarget } from '@yishan/demo-config'

const apiTarget = resolveApiTarget('http://localhost:3100')
```

启动时设置环境变量，Bash：

```bash
# API 跑在 3200 端口，其余沿用默认地址
YISHAN_API_PORT=3200 pnpm dev:admin

# 代理到远程 API
API_TARGET=https://api.example.com pnpm dev:admin
```

PowerShell：

```powershell
$env:YISHAN_API_PORT = "3200"; pnpm dev:admin
```

解析结果：

| 环境变量 | 默认地址 | 结果 |
| --- | --- | --- |
| 未设置 | `http://localhost:3100` | `http://localhost:3100` |
| `YISHAN_API_PORT=3200` | `http://localhost:3100` | `http://localhost:3200` |
| `YISHAN_API_PORT=3200` | `http://localhost:3100/v1` | `http://localhost:3200/v1` |
| `YISHAN_API_PORT=3200`、`API_TARGET=https://api.example.com` | `http://localhost:3100` | `https://api.example.com` |
| `YISHAN_API_PORT=abc` | `http://localhost:3100` | 抛出 `YISHAN_API_PORT must be an integer between 1 and 65535` |

Admin dev-server 自身端口用 `ADMIN_PORT`，与 API 地址无关。
