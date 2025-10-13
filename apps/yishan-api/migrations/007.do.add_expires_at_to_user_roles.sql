-- 为用户角色关联表添加过期时间字段
-- 创建时间：2025年1月
-- 版本：v1.1
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 为 sys_user_role 表添加字段
-- ----------------------------
ALTER TABLE `sys_user_role` 
ADD COLUMN `assigned_at` timestamp NULL DEFAULT NULL COMMENT '分配时间' AFTER `updater_id`,
ADD COLUMN `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间' AFTER `assigned_at`;

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 过期时间索引（用于查询过期的用户角色）
CREATE INDEX `idx_expires_at` ON `sys_user_role` (`expires_at`);

-- 复合索引：用户ID+过期时间（用于查询用户未过期的角色）
CREATE INDEX `idx_user_expires` ON `sys_user_role` (`user_id`, `expires_at`);

-- 复合索引：角色ID+过期时间（用于查询角色下未过期的用户）
CREATE INDEX `idx_role_expires` ON `sys_user_role` (`role_id`, `expires_at`);

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;