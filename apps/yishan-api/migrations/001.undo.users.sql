-- 企业级用户表回滚脚本
-- 删除所有相关的数据库对象

SET FOREIGN_KEY_CHECKS = 0;

-- 删除索引（这些索引会在删除表时自动删除，这里显式列出是为了清晰）
DROP INDEX IF EXISTS `uk_username` ON `sys_user`;
DROP INDEX IF EXISTS `uk_email` ON `sys_user`;
DROP INDEX IF EXISTS `uk_phone` ON `sys_user`;
DROP INDEX IF EXISTS `idx_status` ON `sys_user`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_user`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_user`;
DROP INDEX IF EXISTS `idx_creator_id` ON `sys_user`;
DROP INDEX IF EXISTS `idx_updater_id` ON `sys_user`;
DROP INDEX IF EXISTS `idx_status_created` ON `sys_user`;
DROP INDEX IF EXISTS `idx_real_name_status` ON `sys_user`;

-- 删除外键约束（这些约束会在删除表时自动删除，这里显式列出是为了清晰）
ALTER TABLE `sys_user` DROP FOREIGN KEY IF EXISTS `fk_user_creator`;
ALTER TABLE `sys_user` DROP FOREIGN KEY IF EXISTS `fk_user_updater`;

-- 删除表
DROP TABLE IF EXISTS `sys_user`;

SET FOREIGN_KEY_CHECKS = 1;