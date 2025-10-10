-- 企业级用户角色关联表回滚脚本
-- 删除所有相关的数据库对象
-- 创建时间：2025年10月10日
-- 版本：v1.0
-- 作者：zerocmf-team

SET FOREIGN_KEY_CHECKS = 0;

-- 删除索引（这些索引会在删除表时自动删除，这里显式列出是为了清晰）
DROP INDEX IF EXISTS `uk_user_role` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_user_id` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_role_id` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_status` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_user_role`;

-- 删除外键约束（这些约束会在删除表时自动删除，这里显式列出是为了清晰）
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_user`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_role`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_creator`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_updater`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_updater`;

-- ----------------------------
-- Drop table sys_user_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_role`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;