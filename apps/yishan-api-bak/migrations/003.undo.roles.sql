-- 企业级角色管理系统回滚脚本
-- 删除所有相关的数据库对象
-- 创建时间：2025年10月18日
-- 版本：v1.0
-- 作者：zerocmf-team

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 删除用户角色关联表相关索引
-- ----------------------------
DROP INDEX IF EXISTS `idx_user_status` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_role_status` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_expires_at` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_user_expires` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_role_expires` ON `sys_user_role`;
DROP INDEX IF EXISTS `uk_user_role` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_user_id` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_role_id` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_status` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_user_role`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_user_role`;

-- ----------------------------
-- 删除用户角色关联表外键约束
-- ----------------------------
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_user`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_role`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_creator`;
ALTER TABLE `sys_user_role` DROP FOREIGN KEY IF EXISTS `fk_user_role_updater`;

-- ----------------------------
-- Drop table sys_user_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_role`;

-- ----------------------------
-- 删除角色表相关索引
-- ----------------------------
DROP INDEX IF EXISTS `idx_status_created_at` ON `sys_role`;
DROP INDEX IF EXISTS `idx_is_system` ON `sys_role`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_role`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_role`;
DROP INDEX IF EXISTS `idx_sort_order` ON `sys_role`;
DROP INDEX IF EXISTS `idx_status` ON `sys_role`;
DROP INDEX IF EXISTS `uk_role_name` ON `sys_role`;

-- ----------------------------
-- 删除角色表外键约束
-- ----------------------------
ALTER TABLE `sys_role` DROP FOREIGN KEY IF EXISTS `fk_sys_role_updater`;
ALTER TABLE `sys_role` DROP FOREIGN KEY IF EXISTS `fk_sys_role_creator`;

-- ----------------------------
-- Drop table sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;