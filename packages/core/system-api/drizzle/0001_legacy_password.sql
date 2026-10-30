-- 历史密码格式兼容（iximei / ThinkCMF 5.x 迁移）
--
-- 背景：老 iximei 系统的 794 个账号，password_hash 是
--   `###` + md5(md5(authcode + 明文))
-- 与基座的 scrypt v1 完全不是一个算法。原方案要求"全部重置密码"，
-- 实际业务上不可接受。改回老系统的做法：按列分流 + 登录成功即升级。
--
--   password_format
--     0 = 老 iximei（ThinkCMF 5.x）`###<md5>`
--     1 = 基座 scrypt v1
--   默认 1：新建行一律写 scrypt。只有从老库导入的行才会被显式回填 0。
--
--   password_change_recommended
--     0 = 无需提示
--     1 = 登录后应提示用户改密
--   与算法格式**解耦**：登录成功把 hash 升级成 scrypt 时不清此位，
--   只有用户真正走完 changePassword 才清 0。
--
-- phone 改为可空：老库存在手机号为空的账号，而 sys_user_phone_key 是唯一索引。
-- MySQL 唯一索引允许多个 NULL，因此可空 + 唯一是安全组合；若保持 NOT NULL，
-- 导入时多个空手机号会撞唯一键。
--> statement-breakpoint
ALTER TABLE `sys_user` ADD COLUMN `password_format` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `sys_user` ADD COLUMN `password_change_recommended` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sys_user` MODIFY COLUMN `phone` varchar(20) NULL;
