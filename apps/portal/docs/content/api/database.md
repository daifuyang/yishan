---
title: 数据库与模型
---

# 数据库与模型

继续使用 MySQL / Drizzle。Core Database 创建实例连接、事务和关闭能力，不拥有业务表。System API 拥有 sys_* schema；各模块拥有 `<id>`_ schema；产品扩展表独立存储用户业务资料。

发布 SQL/journal 是迁移历史；表 schema 用于类型化查询与生成新的迁移。System 保留 __drizzle_migrations，各模块使用 __drizzle_migrations_`<id>`。迁移按 journal 索引顺序，检查 SHA256/时间/历史归属、锁定单一会话，重复执行不重放历史。MySQL DDL 失败可能已部分生效，禁止吞错、自动 reset 或伪造完成记录。

```bash
pnpm build:api
pnpm --filter @yishan/demo-api db:migrate --check
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm db:seed
```

仅 --apply 写迁移；启动不迁移、不 seed。旧混合共享历史需先 --reconcile-dry-run，再明确 --reconcile-apply；仅复制可唯一证实的模块连续历史，保留原 ledger 和业务数据。未知/跳跃历史需人工审查。

HTTP 字段及 Drizzle 属性使用 lower camel case，数据库列使用 snake_case。动态排序、筛选和投影使用固定类型化列白名单，不能将用户字段拼入 SQL。具体限制见仓库 docs/architecture/database-ownership.md：CRM 旧空库迁移存在重复列，未被静默改写。
