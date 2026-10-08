# Core 首批回迁结果

基线：`main@0dc03c7`。来源：`all@b0764f4`。本批采用选择性回迁，CRM 商业模块继续独立；不整体合并 all。

## 已回迁

| 提交 | 内容 | 来源 |
| --- | --- | --- |
| cb31dec | 系统 users/departments/positions/roles/menus/dicts CRUD 公共实现，导入时声明权限；模块加载优先编译产物；Windows dev 路由排除；App 登录/刷新权限修复；33xxx 错误识别 | CRUD 完整系列，含 c2d9e30、6444469；5a4f0a9；b0764f4 的独立修复 |
| b21445b | 跨平台 dev/build 脚本、排除 example 工作区、管理端和小程序共享开发代理地址 | 25b67dc、58c97ab、f635c96、021016c/f0819ca/7a5fd5c |
| 78b5ca8 | 多层无路径菜单展开；登录失败由表单显示一次并保留输入；开发产物与 dist 隔离 | 722d4f2/981624f/d4184f8、e07ae5c、b0764f4 的 outputPath |
| c9bc885 | 按实际 Umi 请求契约判断登录 URL；跳过异步全局处理时避免额外 Promise 拒绝 | 独立复查发现并修正，新增运行方式回归测试 |

## 兼容性

- 系统 CRUD 的 URL、operationId、请求/响应 schema 和权限代码保留；角色授权和菜单访问检查保留，未改生成客户端。
- App 登录和刷新允许匿名调用；其他接口权限边界保留。
- 整数 33000–33999 作为模块业务错误返回 HTTP 400；30000–32999 保留原处理。
- 模块扫描移除内部 preferSrc 参数，使用 dist 优先、源码回退；onboard 调用同步更新。
- 开发 API 默认地址统一为 `http://localhost:3100`，可用 `YISHAN_API_TARGET` 覆盖。锁文件只改 importer，保留已有依赖解析版本。
- 数据库 schema/迁移历史、存储、部署目标、PUBLIC_PATH/avatar 和 demo 源码均未改动。未引入 CRM、sys_enum 或未接通的按钮权限。

## 实际验证

使用 Node **22.22.1**、pnpm **8.15.9**：

- 冻结锁文件离线安装通过；开发代理默认值和环境覆盖从真实消费者导入通过。
- API 重点 34 项、前端重点 45 项测试通过；变更前的 RED 和变更后的 GREEN 均已观察。
- 最终 `pnpm test`：管理端 6 套/63 项通过；API 285 项通过、5 项失败、20 项跳过。失败全部是基线已有的 demo/system-menu 测试，与回迁前相同，故完整测试命令退出 1。
- API `build:ts`、管理端 build、TipTap build、文档站 build、小程序 build:weapp 通过。管理端严格 tsc 与文档站 typecheck 通过。
- `pnpm lint` 在该隔离目录被管理端既有 `.worktrees` 排除规则阻止；临时仅移除该规则后，全量管理端检查仍有原有附件 audio/video 的 2 个字幕错误。原配置已逐字节恢复；变更文件的 lint 通过。
- 小程序 lint 的类型检查有 44 个错误；恢复原始 main 的配置重新检查后，错误集合完全一致。未扩展本批范围修复旧问题。
- 编译后的模块扫描，在 src 存在及仅 dist 的场景均发现 demo；main 模块白名单和命名检查通过。
- 每组独立复查及整批复查通过。最终独立运行验证：登录错误传给表单、未触发刷新/登出、未处理 Promise 拒绝 **0**。

构建仍有既有 Browserslist/Taro 缓存警告；未执行依赖升级、数据库迁移、远端推送或部署。

后续单独评估：迁移与存储改造、sys_enum、按钮权限闭环，以及 yishan 独立 monorepo Core 的发布/消费机制。
