# 数据库所有权和迁移

Core Database 只管理数据库连接工厂、Drizzle context、关闭与迁移执行；System 拥有 sys_* schema/仓储，System 初始建库由一份基线迁移承载；产品业务模块拥有 `<id>_` 表和各自 SQL/journal。Demo 用户扩展拥有 `demo_user_profile`，不改身份核心表。每个产品使用自己注入的连接。

## 安全执行

应用从安装清单生成业务模块 migration manifests；System 使用 `__drizzle_migrations`，各业务模块使用 `__drizzle_migrations_<id>`。System 的 `drizzle/0000_init.sql` 是从当前 System schema 生成的单一初始基线，包含 32 张 `sys_*` 表；历史增量和未入 journal、重复创建 `sys_enum` 的 `0010_create-sys-enum.sql` 已并入或清理。业务模块迁移仍保持各自 journal 和账本。runner 按 journal 索引顺序，先检查完整历史，再在单一 MySQL 会话与数据库级 advisory lock 中执行。已记录迁移不重放；SQL 缺失、未知/不匹配历史和无历史已有表失败。

其余历史迁移的发布字节以旧提交 `46b151b134b46cf039388b6bb51a18391d8624ab` 的 Git blob 为准；相应 SQL 的 `.gitattributes -text` 防止 Git 在不同平台转换字节，完整性检查仍保护这些历史文件。System 初始基线是本次有意重建的例外：原 System 增量 SQL 与重复的孤立 enum SQL 已从活动迁移目录移除，单一基线的 SHA256 和 journal 由仓库迁移完整性清单校验，不再接受旧 System 账本哈希。

MySQL DDL 并非整体事务；执行失败不会将失败迁移记为完成。部分 DDL 可能已生效，再次执行会明确拒绝歧义，需操作人员检查修复，不能以吞错保证伪幂等。此次 System journal 压缩会使既有 System migration ledger 无法匹配新基线；切换前须由运维单独备份并重建目标数据库，再显式执行 migration 和 seed。migration runner 不会清库，也不会自动重置账本。

```bash
pnpm --filter @yishan/demo-api db:migrate --check    # 检查文件与journal，无连接
pnpm --filter @yishan/demo-api db:migrate --dry-run  # 只读检查目标历史及pending
pnpm --filter @yishan/demo-api db:migrate --apply    # 显式应用
pnpm db:seed                                       # 显式seed，不执行迁移
```

确认连接环境后才运行写命令；不能在生产自动生成/执行迁移。System 的下一次 schema 变更追加新迁移；业务模块继续用各自 owner 的 drizzle.config.ts。应用启动不会迁移或运行 seed。

## 旧账本处理

当前 System 单一基线不支持从旧 System ledger 自动核对或接续。已有库需按上面的受控重建流程切换。业务模块的旧共享 ledger 仍可通过显式 reconciliation 核对和拆分记录，原账本保持不变：

```bash
pnpm --filter @yishan/demo-api db:migrate --reconcile-dry-run # SELECT-only，显示待复制账本记录
pnpm --filter @yishan/demo-api db:migrate --reconcile-apply   # 只复制可证实的模块历史，不执行业务SQL
pnpm --filter @yishan/demo-api db:migrate --dry-run           # 再检查正常pending
pnpm --filter @yishan/demo-api db:migrate --apply
```

每条共享记录必须以原 SHA256 + journal 时间戳唯一匹配已安装 manifest，按 ledger 插入顺序形成该 owner 的连续 journal 前缀；现有模块账本也必须是相同前缀。核对所有 owner 和 pending CREATE 目标之后，才在单一会话和迁移锁中补写缺失模块账本记录。重复调用不会重复复制，正常迁移不会自动拆分历史。未知归属、多重匹配、重复记录、改写 SQL 或旧时间判断跳过了中间迁移均在写入之前拒绝；不能将缺失迁移伪记为完成。

只读检查验证历史与已存在 CREATE 目标，不执行 pending SQL，不能预判后续 ALTER 的所有语义错误。真实空库 CRM 测试首先在 `0006_lead-conversion-links` 第 1 条语句失败：`0001_add-leads.sql` 已包含 `converted_customer_id`，该迁移再次添加同名字段。末尾追加修复迁移无法越过这个更早的失败；在保留已发布 SQL/hash/journal 的约束下，需要单独的、人工审查过的历史基线修复方案，不能自动忽略或伪造历史。

旧源码模块 drizzle 配置没有独立 historyTable，可能实际写入共享 ledger；不能因为搬目录直接重新 CREATE。无可唯一识别的旧业务模块历史必须拒绝，先明确所有权。CRM 有 44 SQL、34 journal 项、10 个孤立 SQL及非单调时间；其中两个 journal 项重复创建 customer_member / activity.deleted_at，空库安装会失败。禁止自动补 journal 或以忽略重复 DDL 掩盖。

这些限制和实际隔离 MySQL 测试结果在 [迁移报告](api-migration-report.md) 中单独列出。Seed 幂等、只补缺失管理员和配置；不会覆盖已有密码/真实数据。模块 seed 的菜单和枚举贡献先验证 moduleId 所有权。
