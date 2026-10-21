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
├── bin/deploy.sh                # 受控部署执行器（CI 唯一能跑的东西，root:root 0755）
├── bin/release.sh              # 切换 + 健康检查 + 自动回滚
├── current -> releases/<时间戳> # systemd 的 WorkingDirectory
├── releases/<时间戳>/           # 每次发布一个新目录，保留最近 3 个
│   ├── dist/ node_modules/ package.json
│   └── public/admin/           # Admin 静态产物（由 package-api.mjs 拷入）
│                               # public/uploads 是软链 -> shared/uploads
├── h5-current -> h5/<时间戳>  # nginx 的 root（H5 站点）
├── h5/<时间戳>/                # H5 静态产物，保留最近 3 个
├── incoming/                   # 上传暂存
└── shared/
    ├── .env                     # 运行时环境变量（不进仓库）
    └── uploads/                 # 用户上传，跨 release 保留
```

`uploads` 放在 release 之外是刻意的：回滚或清理旧版本时不能丢用户文件。

### 目标机上的文件与仓库的对应关系

目标机上有三份"机器才有、仓库没有"的文件。它们现在**全部在仓库里**，目标机是它们的安装副本：

| 目标机 | 仓库 | 说明 |
|---|---|---|
| `/opt/yishan/bin/deploy.sh` | `bin/deploy.sh` | 受控部署执行器，CI 唯一能跑的入口 |
| `/opt/yishan/bin/release.sh` | `bin/release.sh` | 切软链 + 重启 + 健康检查 + 自动回滚 |
| `/opt/yishan/bin/release-h5.sh` | `bin/release-h5.sh` | 切 `h5-current` + 内容健康检查 + 自动回滚（H5 专用） |
| `/etc/systemd/system/yishan-api.service` | `templates/yishan-api.service` | systemd 单元 |
| `/opt/yishan/shared/.env` | `templates/env.example` | 运行时环境变量（**只有模板进仓库**，真值留在机器上，0640 root:ubuntu） |

> 曾经 `release.sh` 只存在于那台机器上，连同它的修复（健康检查竞态、保留回滚落点）
> 一起躺在别人的分支里。现在主机上的文件与仓库逐字节一致，改法见下面「改了 deploy.sh 怎么办」
> 同款的"装到机器上"流程。

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
build（Linux runner 打包）→ 传到七牛云 → 目标机拉取 + 解包 + 迁移 → release.sh → 公网冒烟
```

几个和手工不同的点：

- **不等 CI 绿。** FC 那条流水线会等 `yishan-fullstack-ci` 通过才发布；演示环境不等，
  CI 只是并行的质量报表（deploy 作业里有一步只报告不拦截）。这是显式取舍：演示站
  是给外部看的，上线时效比「代码必须先绿」更要紧。兜底是 `release.sh` 的健康检查与
  自动回滚，外加「编译不过根本打不出包」——build 失败就不会发布。
  要改回等 CI，把 deploy 作业的 `needs` 加回一个 `ci-gate` 作业即可。
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
- **`release.sh` 是由受控执行器以 root 跑的。** CI 不再直接 ssh 执行任意脚本，
  详见下面「部署凭据与权限模型」。
- **并发不打断。** `cancel-in-progress: false`：取消点不可控，可能正好落在「已解包、
  迁移跑一半、软链还没切」的窗口里，留下半成品目录和悬空迁移。
- **冒烟打的是公网入口** `https://admin.zerocmf.com`：`/api/health`（含 `db.ok`）、
  `/` 必须包含 SPA 挂载点**并且**能把入口页引用的 `umi.<hash>.js` 真正取回来（校验
  `Content-Type` 是 JavaScript）、`/admin` 必须返回 301。这几条是 `release.sh` 视野之外的
  （nginx、域名、静态资源路径），release.sh 只看得到本机进程。

需要的 GitHub 配置（environment `YISHAN_DEMO_UBUNTU`）：

| 名称 | 类型 | 值 |
|---|---|---|
| `UBUNTU_DEPLOYER_SSH_KEY` | secret | **专用** deployer 私钥（不是管理员钥匙） |
| `UBUNTU_HOST` | var | `43.143.122.225` |
| `UBUNTU_USER` | var | `deployer` |
| `UBUNTU_SSH_FINGERPRINT` | var | 目标机 ed25519 指纹，**必填**（不填直接中止发布） |
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

重放某一次发布：Actions 上手动 `workflow_dispatch`（刚手工跑过迁移可再勾 `skip_migrations`）。

### H5 发布（小程序 H5）

`h5.zerocmf.com` 由 `.github/workflows/yishan-h5-cd-ubuntu.yml` 发布，形状和上面那条
流水线同构，但**没有迁移步骤**，产物也换成静态目录：

```
build（Linux runner 跑 taro build --type h5）→ 七牛 → h5-unpack → h5-release → 公网冒烟
```

它和 API 共用同一台机器、同一套受控执行器、同一份 deployer 密钥，但动词互不重叠：
`h5-unpack` / `h5-release` 只碰 `/opt/yishan/h5/`，`unpack` / `release` 只碰
`/opt/yishan/releases/`。两个目录混在一起会让两边的历史版本清理互相删错东西。

`release-h5.sh` 和 `release.sh` 的关键差别：**不重启任何服务**。H5 是纯静态，nginx 按
`h5-current` 软链读目录，软链一换下一个请求就读到新版本。代价是"进程在跑"不构成健康
信号，所以健康检查只能落在内容上：

1. 首页必须返回 200 且含 `<title>`；
2. **首页引用的每个本地资源都必须真的存在于新目录里**。只看 200 挡不住「index.html 正常、
   脚本全 404」的白屏，而这是静态发布最常见的坏法（解包不完整、路径前缀写错都长这样）；
3. 任意一条不过立即把 `h5-current` 切回上一版。

第 2 条在目标机本地 nginx 上验（`--resolve h5.zerocmf.com:443:127.0.0.1`，走正确的
server 块），公网冒烟再从外网把首页引用的资源逐个取一遍，补上 DNS、证书这一层。

H5 站点与 API 同域：`/api` 和 `/uploads` 由 nginx 反代到 `127.0.0.1:3000`，所以 H5 构建
必须把 `YISHAN_APP_API_BASE_URL` 留空（空 = 同源请求），写死域名会让它在任何非该域名
的环境下都去跨域打 API。

需要的 GitHub 配置复用 environment `YISHAN_DEMO_UBUNTU` 里已有的变量，只需多一个可选的
`H5_SMOKE_BASE_URL`（默认 `https://h5.zerocmf.com`）。`deploy.sh` 的版本从
`20261020-1` 提到 `20261021-1`，两条流水线共用这个校验值——目标机上跑的还是旧脚本时，
H5 这条会在开头就报出版本不符，而不是传完 5MB 产物才失败。

## 部署凭据与权限模型

CI 用的私钥一旦泄露，爆炸半径取决于**目标机上这把钥匙能干什么**。早先的形态是：CI 用的是
`ubuntu` 这个日常管理账号的钥匙，而 `ubuntu` 有 `(ALL) NOPASSWD: ALL`——等于把 root
交给了 GitHub secret。secret 又存在仓库级 / 无保护 environment 里，任何能改 workflow
的人都能把它读出来。

现在的模型是三层收口，**这把钥匙能做的最坏事 = 发布一个产物**：

```
CI ──ssh──▶ deployer 账号
             ├─ authorized_keys: command="sudo -n /opt/yishan/bin/deploy.sh",restrict
             │    ├─ command=  忽略客户端请求的任何命令，只跑这一个脚本
             │    └─ restrict  关掉 pty / 端口转发 / agent 转发 / X11 / user rc
             ├─ sudoers: deployer ALL=(root) NOPASSWD: /opt/yishan/bin/deploy.sh
             │    └─ 只放行这一个命令，不是 ALL
             └─ deploy.sh（root:root 0755，仓库里在 bin/deploy.sh）
                  └─ 严格解析 SSH_ORIGINAL_COMMAND：白名单动词 + 参数逐个正则校验
```

- 客户端请求的内容通过 `SSH_ORIGINAL_COMMAND` 传过去（sudo 默认清空环境，所以
  sudoers 里配了 `Defaults:deployer env_keep += "SSH_ORIGINAL_COMMAND"`）。
- `deploy.sh` 只认 `fetch` / `unpack` / `migrate` / `release` / `cleanup` / `version`
  六个动词，参数按正则校验（文件名、时间戳、sha、sha256、base64），**不做 eval**，
  也不把参数拼回 shell 命令行。
- 整个脚本以 root 跑，所以它能读 `shared/.env`、能 `systemctl restart`；但它只做
  这六件事。
- 每次部署在 `auth.log` 留一条 sudo 记录，脚本另外用 `logger -t yishan-deploy` 记审计日志。

### 改了 deploy.sh 怎么办

仓库里的 `bin/deploy.sh` 是**源**，目标机上的 `/opt/yishan/bin/deploy.sh` 是它的安装副本。
改了源要同步装到机器上，并 bump 脚本里的 `VERSION` 与 workflow 里的
`DEPLOY_SCRIPT_VERSION`——流水线每次发布前会核对版本，不一致直接中止（避免"workflow
传了新参数、机器上还是旧脚本"这种糊涂错）。

```bash
# 1. 改仓库里的 apps/demo/api/deploy/ubuntu/bin/deploy.sh，并 bump VERSION
# 2. 装到目标机
scp -i ~/workspace/certs/ubuntu_tencent.pem \
    apps/demo/api/deploy/ubuntu/bin/deploy.sh \
    ubuntu@43.143.122.225:/tmp/deploy.sh
ssh -i ~/workspace/certs/ubuntu_tencent.pem ubuntu@43.143.122.225 \
    "sudo install -o root -g root -m 0755 /tmp/deploy.sh /opt/yishan/bin/deploy.sh && \
     sudo rm -f /tmp/deploy.sh"
# 3. 同步 bump .github/workflows/yishan-api-cd-ubuntu.yml 里的 DEPLOY_SCRIPT_VERSION
```

`release.sh` 的改动同理（`bin/release.sh` → `/opt/yishan/bin/release.sh`），只是它没有版本
号校验，装完直接生效；systemd 单元改完还要 `sudo systemctl daemon-reload`。

### 换 deployer 密钥

```bash
# 1. 本地生成
ssh-keygen -t ed25519 -N "" -C "yishan-deployer@ci" -f ~/workspace/certs/yishan_deployer.pem
# 2. 目标机换公钥（受限条目，注意 command= 和 restrict 都要写）
ssh -i ~/workspace/certs/ubuntu_tencent.pem ubuntu@43.143.122.225 'sudo tee ...'
# 3. 更新 GitHub environment secret
gh secret set UBUNTU_DEPLOYER_SSH_KEY --env YISHAN_DEMO_UBUNTU \
    --repo daifuyang/yishan < ~/workspace/certs/yishan_deployer.pem
# 4. 旧私钥从本机删除、并从任何 authorized_keys 里摘掉
```

### 目标机的 sshd 加固

`/etc/ssh/sshd_config.d/10-yishan-hardening.conf`：

```ini
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
```

**文件名里的 `10-` 不能改。** sshd 读 drop-in 按字典序，且是「首次出现即生效」——机器上
自带一个 `50-cloud-init.conf`，里面写着 `PasswordAuthentication yes`。drop-in 叫
`99-...` 的话排在它后面，那行 `no` 压根不生效，而 `sshd -T` 会照实显示
`passwordauthentication yes`。改完记得 `sudo sshd -t && sudo systemctl reload ssh`，
再用 `sudo sshd -T | grep -E '^(password|permitrootlogin)'` 确认生效值。

> 这台机器在公网上，`auth.log` 里有过两千多条失败登录记录——有扫描器在挨个试。
> 密钥登录留着，密码和 root 直登已经关掉。

### 一次发布要多久

推 `main` 到站点可访问，大约 **4 分钟**：

| 阶段 | 耗时 |
|---|---|
| build：装依赖 → 编 Admin → 编 API → 打包 → 传七牛 | ~2.5 min |
| deploy：目标机拉取 → 解包 → 迁移 → 切软链 → 冒烟 | ~1.5 min |

CI 与发布**并行**跑，互不等待（CI 现在约 5 分钟，只作质量报表）。
早先的版本要在 CI 上白等 8 分钟，而且产物是跨境 scp 传的（30 分钟），
两处加起来要 45 分钟左右。

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

**每个 vhost 的 80 端口块都要显式跳 HTTPS。** 只写 `root /var/www/acme-challenge;`
的块（ACME webroot）在 HTTP 上会对 `/` 返回 403、对其它路径 404——目录里没有
index，且 nginx 默认不列目录。正确形态与 `codecloud.tech` / `yugongsoft.com` 一致：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name <host>;

    location /.well-known/acme-challenge/ {
        root /var/www/acme-challenge;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

### 旧域名 yishan.zerocmf.com → admin.zerocmf.com

2026-10-20 起，`yishan.zerocmf.com` 从「FC 自定义域名」改成指向本机的 A 记录，
由 `/etc/nginx/sites-available/yishan-redirect.conf` 做 **301 永久跳转**：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yishan.zerocmf.com;

    location /.well-known/acme-challenge/ { root /var/www/acme-challenge; }
    location / { return 301 https://admin.zerocmf.com$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 http2;
    server_name yishan.zerocmf.com;

    ssl_certificate     /etc/nginx/certs/yishan.zerocmf.com.fullchain.crt;
    ssl_certificate_key /etc/nginx/certs/yishan.zerocmf.com.key;

    location / { return 301 https://admin.zerocmf.com$request_uri; }
}
```

`$request_uri` 保留路径与查询串，所以旧 API 客户端打
`https://yishan.zerocmf.com/api/v1/xxx` 会落到
`https://admin.zerocmf.com/api/v1/xxx`——后端就托管在 admin 域名的 `/api` 下。

DNS 记录用 `aic` 改（`@zerocmf/aic` 云资源 CLI）：

```bash
aic dns:list zerocmf.com                       # 记下旧记录 id
aic dns:delete <旧记录 id>                     # 原 CNAME → FC 自定义域名
aic dns:add zerocmf.com yishan A 43.143.122.225 --ttl 600
```

证书用本机 acme.sh 的 **HTTP-01**（webroot `/var/www/acme-challenge`，每日 0:39 的
cron 自动续期并 reload nginx）：

```bash
~/acme.sh/acme.sh --issue -d yishan.zerocmf.com -w /var/www/acme-challenge
~/acme.sh/acme.sh --install-cert -d yishan.zerocmf.com \
  --key-file /etc/nginx/certs/yishan.zerocmf.com.key \
  --fullchain-file /etc/nginx/certs/yishan.zerocmf.com.fullchain.crt \
  --reloadcmd "sudo systemctl reload nginx"
```

签发必须在 DNS 指到本机**之后**（HTTP-01 要能访问 challenge 路径），且 80 端口
的 vhost 要先存在。

> 阿里云云解析的 `REDIRECT_URL`（显性 URL）**不能**用来做这件事：转发前域名只支持
> HTTP，且 `Location` 是写死的目标 URL，不保留路径与查询串。

## 与 FC 的差异

阿里云 FC 已于 2026-10-21 下线（`yishan-api-cd.yml` 已移出 `.github/workflows/`，
作为参考实现留在 `apps/demo/api/deploy/fc-example/`），`PUBLIC_PATH=/admin/` 的那条路径
目前只作为静态插件支持的形态保留在代码里。若将来恢复 FC 发布，不要为了「统一」
把演示环境切到 `/admin/`——两者形态不同是有意的。

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
