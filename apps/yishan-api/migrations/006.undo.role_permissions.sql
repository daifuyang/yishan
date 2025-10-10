-- 企业级角色权限关联表回滚脚本
-- 删除所有相关的数据库对象
-- 创建时间：2025年10月10日
-- 版本：v1.0
-- 作者：zerocmf-team

SET FOREIGN_KEY_CHECKS = 0;

-- 删除索引（这些索引会在删除表时自动删除，这里显式列出是为了清晰）
-- 删除索引（这些索引会在删除表时自动删除，这里显式列出是为了清晰）
DROP INDEX IF EXISTS `uk_role_permission` ON `sys_role_permission`;
DROP INDEX IF EXISTS `idx_role_id` ON `sys_role_permission`;
DROP INDEX IF EXISTS `idx_permission_id` ON `sys_role_permission`;
DROP INDEX IF EXISTS `idx_status` ON `sys_role_permission`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_role_permission`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_role_permission`;

-- 删除外键约束（这些约束会在删除表时自动删除，这里显式列出是为了清晰）
ALTER TABLE `sys_role_permission` DROP FOREIGN KEY IF EXISTS `fk_role_permission_role`;
ALTER TABLE `sys_role_permission` DROP FOREIGN KEY IF EXISTS `fk_role_permission_permission`;
ALTER TABLE `sys_role_permission` DROP FOREIGN KEY IF EXISTS `fk_role_permission_creator`;
ALTER TABLE `sys_role_permission` DROP FOREIGN KEY IF EXISTS `fk_role_permission_updater`;

-- ----------------------------
-- Drop table sys_role_permission
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_permission`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;