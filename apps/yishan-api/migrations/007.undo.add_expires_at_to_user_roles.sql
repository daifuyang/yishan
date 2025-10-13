-- 回滚：移除用户角色关联表的过期时间字段
-- 创建时间：2025年1月
-- 版本：v1.1
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 删除索引
-- ----------------------------
DROP INDEX `idx_expires_at` ON `sys_user_role`;
DROP INDEX `idx_user_expires` ON `sys_user_role`;
DROP INDEX `idx_role_expires` ON `sys_user_role`;

-- ----------------------------
-- 从 sys_user_role 表删除字段
-- ----------------------------
ALTER TABLE `sys_user_role` 
DROP COLUMN `expires_at`,
DROP COLUMN `assigned_at`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;