-- 企业级部门表回滚脚本
-- 删除所有相关的数据库对象
-- 创建时间：2025年1月
-- 版本：v1.0
-- 作者：zerocmf-team

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 从用户表移除部门关联字段
-- ----------------------------
ALTER TABLE `sys_user` DROP INDEX IF EXISTS `idx_dept_id`;
ALTER TABLE `sys_user` DROP COLUMN IF EXISTS `dept_id`;

-- ----------------------------
-- 删除部门表相关索引
-- ----------------------------
DROP INDEX IF EXISTS `idx_parent_status_sort` ON `sys_department`;
DROP INDEX IF EXISTS `idx_type_status` ON `sys_department`;
DROP INDEX IF EXISTS `idx_status_created_at` ON `sys_department`;
DROP INDEX IF EXISTS `uk_dept_name_parent` ON `sys_department`;
DROP INDEX IF EXISTS `idx_parent_id` ON `sys_department`;
DROP INDEX IF EXISTS `idx_status` ON `sys_department`;
DROP INDEX IF EXISTS `idx_dept_type` ON `sys_department`;
DROP INDEX IF EXISTS `idx_sort_order` ON `sys_department`;
DROP INDEX IF EXISTS `idx_leader_id` ON `sys_department`;
DROP INDEX IF EXISTS `idx_created_at` ON `sys_department`;
DROP INDEX IF EXISTS `idx_deleted_at` ON `sys_department`;

-- ----------------------------
-- Drop table sys_department
-- ----------------------------
DROP TABLE IF EXISTS `sys_department`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;