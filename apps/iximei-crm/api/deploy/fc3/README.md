# iximei-crm — 阿里云函数计算（FC 3.0）部署

与 `apps/demo/api/deploy/fc3` 同构：pnpm workspace 打成**自包含产物**（含
`node_modules`），由 FC 自定义 runtime 直接 `node ./dist/main.js` 启动。
**不使用 Layer** —— 依赖全部进代码包，版本不会和其他函数互相影响。

## 组成

| 文件 | 作用 |
|---|---|
| `scripts/pre-deploy.sh` | 构建 workspace 依赖 → `scripts/package-api.mjs` 打产物到 `.build/function-code` |
| `scripts/deploy-function.sh` | `s deploy` 函数本体 |
| `templates/function.yaml` | 函数定义（custom.debian12 / 2048MB / VPC / HTTP 触发器） |
| `templates/domain.yaml` | 自定义域名 + HTTPS 证书绑定（**certConfig 三项必须齐备**，见文件内注释） |

## 手动部署

```bash
export FUNCTION_REGION=cn-shanghai
export FUNCTION_NAME=iximei-crm
export FUNCTION_DESCRIPTION="iximei CRM"
export FUNCTION_VPC_ID=vpc-xxx
export FUNCTION_VSWITCH_ID=vsw-xxx
export FUNCTION_SECURITY_GROUP=sg-xxx
# 数据库 / Redis / JWT 等按 templates/function.yaml 里的 env 名逐个 export

cd apps/iximei-crm/api
bash ./deploy/fc3/scripts/pre-deploy.sh
bash ./deploy/fc3/scripts/deploy-function.sh
```

## 只发 API，不带 Admin

`pre-deploy.sh` 只有在传入 `ADMIN_DIST` 时才把前端产物塞进 `public/admin`：

```bash
ADMIN_DIST=/abs/path/to/admin/dist bash ./deploy/fc3/scripts/pre-deploy.sh
```

不传时 `/admin/` 返回 404，而不是上线一个空壳导致前端白屏。

## Windows 上不能产出可部署产物

`scripts/package-api.mjs` 会校验产物里没有绝对路径软链。pnpm 在 Windows 上
把 workspace 依赖建成 junction（绝对路径），因此产物不可移植 —— 上游对此是
**硬失败**，不是警告：

```
pnpm on Windows emits absolute junction targets, so this artifact only works on this machine.
```

本地只想看产物结构时，直接用 `node scripts/package-api.mjs --api ... --output ...
--allow-nonportable-links`，但**不要拿它部署**。真正的部署产物必须在 Linux（CI）上打。

## 数据库迁移

迁移**不**在这里跑。函数实例不持有迁移权限，也避免多实例并发迁移。
迁移走独立流程（`yishan-fc-migrate` 那一类），先迁移成功再发代码。
