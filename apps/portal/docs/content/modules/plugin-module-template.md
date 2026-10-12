---
title: 模块文档模板
---

# 模块文档模板

模块说明应跟随真实实现，按需写明：

- 业务范围与已有流程。
- Product manifest 安装入口、ApiModule contractVersion2、依赖及版本。
- `apps/<product>/api/src/modules/<id>/` 的路由、Service、Repository、TypeBox schema 和测试。
- HTTP `/api/<id>/...` 路径、匿名/受保护权限、错误码与 envelope。
- `<id>_` 表、独立迁移资源/historyTable、幂等 seed 贡献。
- 菜单 `/<id>/...`、现有 Admin module pages，不创造新的 UI 机制。
- 实际验证命令、外部环境限制及生产部署说明。

System 能力位于 packages/core/system-api，模块不得导入其私有 Repository 或 sys_* 表。用户扩展通过公开目录、受控校验/领域事件及独立扩展表实现。参考[模块接入指南](./onboarding.md)与 Demo 的真实模块。
