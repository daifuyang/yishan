-- 回滚用户令牌表
-- 创建时间：2025年01月27日
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Drop table sys_user_token
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_token`;

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;