-- 企业级角色表回滚脚本
-- 删除所有相关的数据库对象
-- 创建时间：2025年10月10日
-- 版本：v1.0
-- 作者：zerocmf-team

SET FOREIGN_KEY_CHECKS = 0;

-- 删除角色表相关索引
DROP INDEX IF EXISTS `idx_is_system` ON `sys_role`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_role`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_role`;
DROP INDEX IF EXISTS `idx_status` ON `sys_role`;
DROP INDEX IF EXISTS `uk_role_name` ON `sys_role`;

-- 删除外键约束
ALTER TABLE `sys_role` DROP FOREIGN KEY IF EXISTS `fk_sys_role_updater`;
ALTER TABLE `sys_role` DROP FOREIGN KEY IF EXISTS `fk_sys_role_creator`;

-- ----------------------------
-- Drop table sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;