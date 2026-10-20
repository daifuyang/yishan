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

**打包必须在 Linux 上做**（CI，或一台 Linux 构建机）。第 4 步在 Windows 上会直接失败：

```
Artifact link is not portable: node_modules\.pnpm\...\provider -> C:\Users\...\provider
pnpm on Windows emits absolute junction targets, so this artifact only works on this machine.
```

`pnpm deploy` 在 Windows 上生成的是 junction（目标 `\\?\C:\...`）。产物在本机能跑、能过
启动冒烟，拷到 Ubuntu 就是一堆死链，报错还是部署之后才出现的
`Cannot find module 'dotenv/config'`。junction 不支持相对目标，没有事后修正的余地，
所以 `scripts/package-api.mjs` 现在直接在打包时拒绝。Admin 的 `dist` 不受此限——纯静态
文件，哪台机器构建都行。

```bash
# 1. 依赖
pnpm install --frozen-lockfile

# 2. Admin —— PUBLIC_PATH 必须是 /，见「路径形态」一节
pnpm --filter @yishan/tiptap build
pnpm --filter @yishan/demo-admin exec max setup
PUBLIC_PATH=/ pnpm --filter @yishan/demo-admin build

# 3. API
pnpm -r --filter @yishan/demo-api... build

# 4. 打包（必须在 Linux 上跑；含产物闭包自检：依赖完整性 + 可移植性 + 启动冒烟）
node scripts/package-api.mjs --output ./out/function-code --admin ./apps/demo/admin/dist
```

只在本机做冒烟、不用于部署时，可以加 `--allow-nonportable-links` 跳过可移植性检查——
但那样出来的产物**只能**在本机用。

### 自动发布（CI）

推 `main` 会触发 `.github/workflows/yishan-api-cd-ubuntu.yml`，它替你做完上面全部步骤：

```
ci-gate → build（Linux runner 打包）→ 传到七牛云 → 目标机拉取 + 解包 + 迁移 → release.sh → 公网冒烟
```

几个和手工不同的点：

- **打包在 runner 上，不在本机。** runner 是 ubuntu-latest，天然满足 `assertPortableLink`；
  本机（Windows）打的包会被打包脚本自己挡下。目标机 3.6G 内存跑不动完整构建，所以构建
  也在 runner 上完成，只传产物。
- **迁移在目标机上跑**，不在 runner 上。数据库在阿里云 ECS，安全组只放行本机出口 IP，
  runner 连不上（FC 那条流水线是靠 SSH 端口转发绕过去的，这里不能用）。
  迁移读的是 `/opt/yishan/shared/.env`——与 systemd 同源，**仓库不新增任何数据库凭据**。
- **失败不会切软链。** 解包或迁移失败直接中断，`current` 指向的还是老版本，服务不受影响。
  迁移成功之后 `release.sh` 才切换；它自己健康检查不过会自动回滚。
- **解包和迁移是两个独立步骤。** 解包无条件执行，只有迁移受 `skip_migrations` 控制——
  早先把两者合在一个 `if` 里，勾了跳过迁移就连 release 目录都不存在，`release.sh`
  必然失败。
- **迁移用的 node 版本是钉死的。** 目标机交互式 shell 走 nvm，PATH 上的 node 是 v24，
  而 systemd 单元 `ExecStart` 用的是 `/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node`
  （v22.22.1）。流水线显式解析绝对路径，让迁移和线上运行时跑在同一个 Node 上。
- **`release.sh` 是用 `sudo` 调的。** 它内部要 `systemctl restart`，`ubuntu` 用户虽有
  免密 sudo，但非 root 直接 systemctl 一样会被拒。
- **并发不打断。** `cancel-in-progress: false`：取消点不可控，可能正好落在「已解包、
  迁移跑一半、软链还没切」的窗口里，留下半成品目录和悬空迁移。
- **冒烟打的是公网入口** `https://admin.zerocmf.com`：`/api/health`（含 `db.ok`）、
  `/` 必须包含 SPA 挂载点**并且**能把入口页引用的 `umi.<hash>.js` 真正取回来（校验
  `Content-Type` 是 JavaScript）、`/admin` 必须返回 301。这几条是 `release.sh` 视野之外的
  （nginx、域名、静态资源路径），release.sh 只看得到本机进程。

需要的 GitHub 配置（environment `YISHAN_DEMO_UBUNTU`）：

| 名称 | 类型 | 值 |
|---|---|---|
| `UBUNTU_DEPLOYER_SSH_KEY` | secret | 能执行 `release.sh` 的 deployer 私钥 |
| `UBUNTU_HOST` | var | `43.143.122.225` |
| `UBUNTU_USER` | var | `ubuntu` |
| `UBUNTU_SSH_FINGERPRINT` | var | 目标机 ed25519 指纹；不配则退回 `ssh-keyscan` 直采 |
| `SMOKE_BASE_URL` | var | `https://admin.zerocmf.com` |

产物中转用的七牛凭据是**仓库级**的（build 和 deploy 两个作业都要用）：

| 名称 | 类型 | 值 |
|---|---|---|
| `QINIU_ACCESS_KEY` | secret | 七牛 AK |
| `QINIU_SECRET_KEY` | secret | 七牛 SK |
| `QINIU_BUCKET` | var | 产物桶（`ai-code`，私有） |
| `QINIU_DOMAIN` | var | 桶绑定的下载域名（`cdn.zerocmf.com`） |

现有的 `ECS_DEPLOYER_SSH_KEY` 不能复用：它对应的远端 `tunnel-dsh` 是受限命令，只能做
端口转发，scp 会被拒。

重放某一次发布：Actions 上手动 `workflow_dispatch`，需要跳过 CI 门禁时勾 `skip_ci_gate`
（刚手工跑过迁移可再勾 `skip_migrations`）。

### 迭代发布时不要陪跑 CI

`ci-gate` 会轮询 `yishan-fullstack-ci` 在同一 commit 上的运行结论，超时 3000s。改部署脚本
本身（解包/迁移/切换/冒烟）时这条等待是纯粹的浪费——你要验的是部署逻辑，不是产品代码。
勾 `skip_ci_gate` 直接部署，零等待；等改完再推一个正常 commit 让 CI 兜底。

### 产物怎么传到目标机（七牛云中转）

早期版本是 runner 用 `scp`/`rsync` 直传目标机。**这条路不能走**：runner 在 GitHub（境外），
目标机在腾讯云，跨境单条 SSH 长连接实测只有约 **16 KB/s**，28MB 的产物要传 **30 分钟出头**，
还经常在「刚好传完」的那一刻撞上作业超时。

现在改成两段：

```
runner ──上传──▶ 七牛云对象存储 ──下载──▶ 目标机
        （境外→境内）              （境内→境内，实测 2-3 MB/s）
```

- 产物 key：`yishan-cd/yishan-api-<sha>.tar.gz`，桶和域名走 `QINIU_BUCKET` / `QINIU_DOMAIN`。
- 桶是**私有**的。runner 生成一条**带签名的临时下载链接**（`?e=过期时间&token=签名`）
  交给目标机，目标机不需要持有任何凭据；链接 2 小时后失效。
- 目标机下载后用 `sha256sum -c` 校验——比只比大小强：比大小只能发现截断，
  发现不了内容损坏；大小对了内容错了的话，要到解包甚至启动时才炸。
- 发布成功后 runner 把七牛上的产物删掉；**失败时保留**，方便手工重放这次发布。
- 产物里不含任何凭据：`scripts/package-api.mjs` 打包时会直接拒绝含 `.env` 的产物。

实现见 `scripts/qiniu-artifact.mjs`（`upload` / `private-url` / `delete` 三个子命令，
无第三方依赖）。七牛的签名有两套容易踩的坑，脚本里都注释了：

- 上传凭证的 scope 绑**桶**，对象 key 走表单字段。写成 `scope: "bucket:key"` 会被判
  `key doesn't match with scope`。
- 下载 token 是 `ak:sign` 明文拼接，**不能再 base64 一遍**；签名串是「域名 + 路径 +
  `?e=` 过期时间」的完整 base URL。少一个字符就是 `bad token`。

同样的道理，FC 那条流水线（走阿里云 FC/OSS）传同一个包只要 2 分半——不是因为它传得更快，
而是因为阿里云在国内，路径根本不跨境。

完整发布周期 = `yishan-fullstack-ci` + 本工作流的 build/deploy。CI 现在按
`guards` / `admin` / `api` / `mobile` 四条线并行（`browser`、`package` 依赖 admin+api 的产物，
只能放在最后），所以墙钟时间取决于最慢那条线，而不是所有步骤之和。


### 手工发布（排障用）

上面几条命令仍然是唯一能在不依赖 CI 的情况下改现场的路径，也是新机器初始化时的路径。

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
# 迁移要在新 release 目录里跑，读 shared/.env 的 DATABASE_URL。
# node 用绝对路径：交互式 shell 的 PATH 上是 nvm 的 v24，服务跑的是 v22.22.1。
NODE=/usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node
ssh -i ~/workspace/certs/ubuntu_tencent.pem ubuntu@43.143.122.225 \
    "cd /opt/yishan/releases/$TS && set -a && . /opt/yishan/shared/.env && set +a && \
     $NODE dist/scripts/migrate.js --dry-run && $NODE dist/scripts/migrate.js --apply"
```

`skip_migrations` 只在「刚手工跑完迁移」时勾选，否则新版本的迁移不会执行就发布了代码。

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
