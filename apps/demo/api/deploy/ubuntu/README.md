# 演示环境部署（腾讯云 Ubuntu）

演示环境跑在腾讯云单机上：**Admin + API + H5 + nginx**。生产环境仍走阿里云 FC，两者的
`PUBLIC_PATH` 不同，见文末「与 FC 的差异」。

## 机器

| 项 | 值 |
|---|---|
| 主机 | `43.143.122.225`（腾讯云 Lighthouse / Ubuntu 24.04.4） |
| SSH | `ssh -i ~/workspace/certs/ubuntu_tencent.pem -o IdentitiesOnly=yes ubuntu@43.143.122.225` |
| 规格 | 4 核 / 3.6G 内存 / 40G 盘 |
| 数据库 | **不在本机**，在阿里云 ECS `139.196.89.64`，安全组只放行本机出口 IP |

密钥与连接信息见 `~/.config/env-config/yishan-demo.yaml`。

> 内存只有 3.6G。**不要在这台机上跑完整 monorepo 构建**——Umi mako + 多个 tsc 一起
> 跑会被 OOM killer 干掉。构建在本地或 CI 完成，只上传产物。

## 目录结构

```
/opt/yishan/
├── bin/release.sh              # 切换 + 健康检查 + 自动回滚
├── current -> releases/<时间戳> # systemd 的 WorkingDirectory
├── releases/<时间戳>/           # 每次发布一个新目录，保留最近 3 个
│   ├── dist/ node_modules/ package.json
│   └── public/admin/           # Admin 静态产物（由 package-api.mjs 拷入）
│                               # public/uploads 是软链 -> shared/uploads
├── incoming/                   # 上传暂存
└── shared/
    ├── .env                     # 运行时环境变量（不进仓库）
    └── uploads/                 # 用户上传，跨 release 保留
```

`uploads` 放在 release 之外是刻意的：回滚或清理旧版本时不能丢用户文件。

## 发布

在**本地或 CI** 构建，然后上传产物：

```bash
# 1. 依赖
pnpm install --frozen-lockfile

# 2. Admin —— PUBLIC_PATH 必须是 /，见「路径形态」一节
pnpm --filter @yishan/tiptap build
pnpm --filter @yishan/demo-admin exec max setup
PUBLIC_PATH=/ pnpm --filter @yishan/demo-admin build

# 3. API
pnpm -r --filter @yishan/demo-api... build

# 4. 打包（含产物闭包自检：依赖完整性 + 启动冒烟）
node scripts/package-api.mjs --output ./out/function-code --admin ./apps/demo/admin/dist
```

上传并切换：

```bash
TS=$(date +%Y%m%d-%H%M%S)
scp -i ~/workspace/certs/ubuntu_tencent.pem -r ./out/function-code \
    ubuntu@43.143.122.225:/opt/yishan/incoming/$TS
ssh -i ~/workspace/certs/ubuntu_tencent.pem ubuntu@43.143.122.225 \
    "sudo mv /opt/yishan/incoming/$TS /opt/yishan/releases/$TS && \
     sudo -u ubuntu bash /opt/yishan/bin/release.sh $TS"
```

`release.sh` 会校验 `dist/main.js` 与 `.yishan-api-artifact.json` 存在、软链切换、重启、
轮询 `/api/health`；不健康会自动软链回上一版。**它不会跑数据库迁移**——DDL 不保证事务
回滚，迁移必须单独在 API 起来之前执行：

```bash
pnpm --filter @yishan/demo-api db:migrate --apply   # 先 --dry-run 看一遍
```

## 路径形态：为什么是 `/` 而不是 `/admin/`

`admin.zerocmf.com` 是独立子域名，Admin 占根路径，`/api` 与 `/uploads` 留给后端。
由两处共同决定，**必须同时改，否则白屏**：

1. **构建时** — `PUBLIC_PATH=/`（产物里资源 URL 是 `/umi.xxx.js`）
2. **运行时** — `/opt/yishan/shared/.env`：

```ini
ADMIN_BASE_PATH=/
ADMIN_REDIRECT_ROOT=false
```

`ADMIN_BASE_PATH` 默认 `/admin`，配合 `ADMIN_REDIRECT_ROOT=true` 会把 `/` 301 到
`/admin/`。两者都改掉即可，`public/admin` 这个**目录名不变**——它由
`ADMIN.diskPath` 固定，和挂载路径无关。

判断是否同步：产物 `public/admin/index.html` 里的资源引用应为 `/umi.*`，而不是
`/admin/umi.*`。

## root 模式下的 `/api` 边界

subpath 模式下 admin 作用域挂在 `/admin` 之下，够不到 `/api`，两者互不干扰。**切到 root
模式后作用域就是整个 `/`，SPA fallback 会吞掉所有未匹配路径**——包括打错的
`/api/...`。那意味着接口拼错时前端拿到的是 `index.html` + HTTP 200："接口调不通"和
"页面正常返回"在现场完全分不开，排查成本极高。

因此 `static.ts` 里对 admin 作用域的 notFoundHandler 加了显式让出分支：

```ts
// packages/core/system-api/src/core/plugins/external/static.ts
if (ADMIN.mount.mode === 'root' && isApiPath(request.url)) {
  return reply.code(404).send({ success: false, code: SystemManageErrorCode.ROUTE_NOT_FOUND, ... })
}
```

两个坑，改动时注意：

- **不能写 `reply.callNotFound()`**。它取的是**当前**上下文的 404 handler，而当前上下文
  就是这个 `adminScope` —— 自己调自己，Fastify 只能回落到内置默认 404
  （`404 Not Found`，text/plain），拿不到 `create-app.ts` 注册的 envelope。能走到这里的
  `/api` 请求必然没匹配到任何真实路由（真实路由更具体，先赢），所以在这里自建 envelope
  与 `create-app.ts` 的输出一致。
- **`isApiPath` 只守 `/api` 这一段公共前缀**。模块路由通常在 `/api/<moduleId>` 下，但产品
  可以用 `module.prefix` 改前缀，再细就得知道全部模块列表，而 static 插件拿不到那份运行时
  信息。

改完的回归用例在 `packages/core/system-api/test/static-plugin.test.ts` 的
「static 插件 — root 挂载模式」。

## 旧前缀 `/admin` 的 301

root 模式下产物 `base` 是 `/`，`/admin/...` 不再对应任何路由，只能落到 SPA 的 404 页。
而浏览器书签、聊天记录里的旧链接、地址栏自动补全仍会把用户送到 `/admin` —— 现场表现
就是「怎么又回到 /admin 了」。所以在 `static.ts` 里（root 模式才启用）把旧前缀 301 回
根路径，**并保留后缀**：

```
/admin              →  301  /
/admin/             →  301  /
/admin/system/user  →  301  /system/user
```

直接丢给首页等于把旧书签作废，所以要剥前缀而不是清空。

排查「为什么又到 /admin」时，先看 nginx 访问日志：地址栏/书签产生的顶层导航 referer 是
`-`，且**不会先出现对 `/` 的请求**；而服务端 301 会同时留下 `GET /` 200 + `GET /admin/`
301 两条记录。这能一眼区分「浏览器送来的」和「我们跳的」。

线上自查：

```bash
curl -si https://admin.zerocmf.com/api/v1/nonexistent-xyz | head -3
# 期望：404 + content-type: application/json
curl -so /dev/null -w '%{http_code} %{content_type}\n' https://admin.zerocmf.com/system/user
# 期望：200 text/html（SPA 深链仍归 admin）
curl -so /dev/null -w '%{http_code} %{redirect_url}\n' https://admin.zerocmf.com/admin/system/user
# 期望：301 https://admin.zerocmf.com/system/user
```

## 只替换单个包的快速热修

纯后端改一行、不涉及 admin 产物时，不必走完整的 `package-api.mjs` 打包：本地 build 后把
`dist` 打进 tgz 传上去，覆盖 release 里对应的 `.pnpm` 真实目录，重启服务即可。

```bash
# 本地
pnpm -r --filter @yishan/demo-api... build
tar -czf /tmp/hotfix.tgz -C packages/core/system-api dist    # tgz 内是 dist/...

# 服务器：先确认目标目录，别凭目录名猜
readlink -f /opt/yishan/current/node_modules/@yishan/core-system-api
# → /opt/yishan/releases/<TS>/node_modules/.pnpm/file+packages+core+system-api_typebox@1.3.6/node_modules/@yishan/core-system-api
```

两个已踩过的坑：

- **别用 `ls -dt releases/* | head -1` 取「最新」**。`cp -a` 保留 mtime，目录 mtime 不反映
  创建顺序，会拿到旧版本并打错补丁。始终用 `readlink -f /opt/yishan/current` 取当前版本。
- **覆盖 dist 会让该 release 与 `.yishan-api-artifact.json` 记录的产物不一致**。release.sh
  只校验文件和健康检查，不校验产物指纹，所以不会拦你 —— 记录要对得上就得重打完整包。

## nginx

`/etc/nginx/sites-available/yishan-admin.conf`，`/api/` 与 `/` 都反代到
`127.0.0.1:3000`——Admin 静态由后端托管，nginx 不直接读文件。证书在
`/etc/nginx/certs/`。

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 与 FC 的差异

生产 FC（`yishan-api-cd.yml`）仍在部署，`PUBLIC_PATH` 由 `vars.ADMIN_BASE_PATH` 驱动，
当前为 `/admin/`。**两套前缀并存是有意的**，不要为了「统一」把生产的也切到 `/`——
生产站点形态不在本次改动范围内。

| | 演示（Ubuntu） | 生产（FC） |
|---|---|---|
| `PUBLIC_PATH` | `/` | `/admin/` |
| `ADMIN_BASE_PATH` | `/` | `/admin` |
| 静态托管 | 后端 `public/admin` | 同左（打进函数 code） |

FC 上的 `yishan-demo` 后续会下线，届时再评估是否统一形态。

## 排障

```bash
sudo journalctl -u yishan-api -f
sudo systemctl status yishan-api
curl -s http://127.0.0.1:3000/api/health
```

- **聊天一直转圈然后整段出现** — SSE 被 nginx 缓冲。`/api/` location 需要
  `proxy_buffering off; proxy_cache off; gzip off;`，否则 `/api/ai/v1/chat` 的流式响应
  会被攒到结束才吐出。
- **页面白屏但网络面板 200** — `PUBLIC_PATH` 与 `ADMIN_BASE_PATH` 不同步，见「路径形态」。
- **`/api` 返回 HTML** — 路由到了 SPA 兜底。先确认 `ADMIN_BASE_PATH=/`；root 模式下后端
  的 admin 作用域覆盖整个根路径，`static.ts` 里对 `/api` 前缀有专门的让出分支
  （`isApiPath`），若打错的 `/api/...` 拿到 `index.html` + 200，说明该分支被绕过。
- **启动被拒** — 生产环境 `JWT_SECRET` 为空或弱值时拒绝启动（`jwt-secret-validator.ts`）。
- **AI 对话不可用** — `AI_CHAT_BASE_URL` 必须是 Anthropic 兼容端点；走
  chat-completions 会静默丢掉 `reasoning_content`。
