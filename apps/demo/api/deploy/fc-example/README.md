# 阿里云 FC 发布工作流（已下线，仅作示例保留）

2026-10-21 起，阿里云 Function Compute 不再作为发布目标。这几条工作流已从
`.github/workflows/` 移出，**不会被 GitHub Actions 执行**，放在这里只作为
「FC 怎么发布」的参考实现和历史记录。

## 为什么下线

H5 也一并迁走了：`h5.zerocmf.com` 现在由 `yishan-h5-cd-ubuntu.yml` 发布到 Ubuntu 主机
（`/opt/yishan/h5-current`），走同一套受控执行器，只是换成了 `h5-unpack` / `h5-release`
两个不碰 `releases/` 的动词。原先 10-19 之后一直是手工往目标机传目录，没有任何自动化。

演示环境迁到 Ubuntu 主机（`43.143.122.225`，腾讯云）后，FC 这条链路的两个问题变得突出：
FC 的部署产物只在函数内可写，调试和排障都要绕；且 `zerocmf.com` 主域的公网
解析已经失效，FC 实际不再承载流量。现在在跑的发布链路是演示环境的两条 CD
（Ubuntu 主机 + 受控 `deploy.sh`）。

## 云上现状

同账号（`enterprise` profile，cn-shanghai）还混有其他项目的函数，**不要整账号清理**。
yishan 相关：

| 函数 | 状态 |
|---|---|
| `yishan-demo-layered` | 已删除（含 httpTrigger） |
| `yishan-h5` | 已删除（含 httpTrigger） |
| `yishan-migration-runner` | 已删除 |
| `yishan-crm` | **保留**，仍在 FC 上运行（`crm.iximei.cn`） |

自定义域名（`demo.zerocmf.com`、`h5.zerocmf.com`、`crm.iximei.cn` 等）保留在账号里，
它们的 function binding 已为空，不再路由到任何函数。

## 文件清单

| 文件 | 原作用 |
|---|---|
| `yishan-api-cd.yml` | API + Admin 打包成 FC 函数部署到 `/admin/*`，先跑迁移再发布，发布后 smoke 校验 |
| `yishan-h5-cd.yml` | Taro H5 静态产物部署到 `yishan-h5` 函数 |
| `yishan-fc-migrate.yml` | 手工触发，通过 SSH 隧道执行 `--dry-run` / `--apply` 迁移 |
| `yishan-cert-rotate-fc.yml` | 定时轮转 FC 自定义域名的证书 |
| `yishan-h5-cert-rotate.yml` | 定时轮转 H5 域名的证书 |

配套的 FC 打包材料仍在原处：`apps/demo/api/deploy/fc3/`、
`apps/demo/app/deploy/fc3/`（`function.yaml` / `domain.yaml` 模板与打包脚本），
因为 `yishan-crm` 还用得上。

## 恢复方式

把文件复制回 `.github/workflows/` 即可（它们的相对路径、secrets 名称都还在文档里），
云上的函数需要重新创建——函数代码不在版本库里。
