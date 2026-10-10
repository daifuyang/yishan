# 公共模块契约

`@yishan/core-contracts` 的 `YishanModule<Router, Context>` 是纯 TypeScript 契约；`@yishan/core-api` 的 `ApiModule<Context>` 指定 Fastify Router。需要 `id/name/version/tablePrefix/contractVersion:2/register`；可选 `prefix/dependencies/migrations/initialize/close/seed`。默认前缀 `/api/<id>`；System 以空前缀保留已有路径。

应用清单明确选择定义。ModuleLoader 校验 ID、版本、前缀、register、契约版本与依赖，按 ID 稳定遍历和拓扑排序。版本依赖使用 semver；缺失、循环和重复在连接资源前失败。路由权限通过 schema 元数据注册到当前实例目录，同一码不同标签/分组失败。

`register` 接收隔离插件 Router 和实例 Context。`initialize` 在所有路由 ready 后执行；`close` 按逆序执行。Seed/迁移只由应用专用命令协调，启动不运行。模块应在自己的插件内部使用 AutoLoad，不通过 Core 固定目录发现业务代码。

`ModuleStateStore` 注入已安装信息同步、启用 ID 查询与缓存失效。Core 不导入 sys_module 表；System 实现使用现有数据库规则，新增记录启用、已有记录保留 enabled。禁用不会动态卸载/安装代码。

`UserDirectory` 提供 findById/findByIds 和历史身份查询选项；`UserExtension` 提供受控写入前校验与写入后事件。扩展资料归应用独立表所有，不能替换身份校验。参见 Demo 实际实现和单元/数据库集成测试。
