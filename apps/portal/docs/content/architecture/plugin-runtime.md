---
title: 插件体系
---

# 模块体系

应用 manifest 明确选择安装模块。Core 的 ModuleLoader 接收模块定义，校验 ID/前缀/契约/版本/依赖，确定性拓扑排序，不假设业务源码位置。模块可来自产品目录、Workspace 或发布 Package。

默认路径 /api/`<id>`/v1/...；System 保留 /api/v1/... 等现有路径。模块内部可 AutoLoad 自己的 routes/，Core 不扫描产品模块目录。菜单仍使用 /`<id>`/...；Admin 页面组织不迁移。

安装层决定路由、权限、OpenAPI、迁移与 seed 是否参与。运行时 sys_module.enabled 控制已安装模块流量，禁用保留数据及安装信息，返回404/code40400；普通未知路由 code25005。开发模块管理使用显式安装清单，生产不暴露开发接口。

接口通过 schema 元数据声明权限；public:true 明确公开，受保护注册缺少认证装饰器时失败。JWT、RBAC、PAT 撤销仍由 System 安全策略执行。

模块 initialize 在 ready 后执行；close 逆序运行并释放应用资源。Seed 与迁移只通过操作命令协调，不随启动运行。源码开发使用 pnpm dev:api，编译包与独立生产产物使用 package exports。
