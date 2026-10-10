# Demo 真实集成验证

运行 `pnpm test:integration` 会先构建完整依赖，再执行数据库、System 和 Demo 产品集成测试。仅运行产品测试可使用 `pnpm --filter @yishan/demo-api test:integration`，前提是 `pnpm build:api` 已完成。

MySQL 固定连接 `127.0.0.1:3306`，创建随机 `yishan_demo_test_<随机值>` schema，并在结束时删除。密码读取本地开发 compose 文件；CI 可设置 `YISHAN_TEST_MYSQL_PASSWORD`，无需传入数据库 URL。

产品测试加载编译产物，执行 System、Demo、Portal、Shop 迁移两次，完整种子两次，并检查用户、角色、菜单、角色菜单、权限和枚举数量与管理员密码不变。重复初始化保留定制的参数、字典、菜单、角色、部门、岗位、地区和 Portal 内容，也保留软删除记录与已撤销授权。真实 Fastify Inject 请求覆盖登录、JWT、RBAC、PAT 范围及撤销、模块启停、扩展事件持久化、参数错误和资源关闭。

OpenAPI 对比使用 `docs/architecture/api-v1-runtime-openapi.json` 中实际旧运行时快照：100 个路径、130 个 schema。新开发环境保留所有旧路径，仅增加 `/api/demo/v1/me/profile`；所有原 schema 相同。两个移动端认证操作补充 `security: []`，准确表示原有公开行为；两个模块管理操作更新说明，表达显式安装清单。其他操作的定义必须与快照一致。旧提交的 166 路径文档另存于 `api-v1-openapi.json`，其中 CRM 路径不属于旧编译 Demo 的实际安装清单。
