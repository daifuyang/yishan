-- 企业级用户表设计
-- 创建时间：2025年09月26日
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_user
-- ----------------------------
CREATE TABLE IF NOT EXISTS `sys_user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `email` varchar(100) NOT NULL COMMENT '邮箱地址',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号码',
  `password_hash` varchar(255) NOT NULL COMMENT '密码哈希(bcrypt加密)',
  `salt` varchar(32) NOT NULL COMMENT '密码盐值',
  `real_name` varchar(50) NOT NULL COMMENT '真实姓名',
  `avatar` varchar(500) DEFAULT NULL COMMENT '头像URL',
  `gender` tinyint(1) DEFAULT 0 COMMENT '性别(0-未知,1-男,2-女)',
  `birth_date` date DEFAULT NULL COMMENT '出生日期',
  `status` tinyint(1) DEFAULT 1 COMMENT '状态(0-禁用,1-启用,2-锁定)',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` varchar(45) DEFAULT NULL COMMENT '最后登录IP',
  `login_count` int(11) DEFAULT 0 COMMENT '登录次数',
  `creator_id` bigint(20) DEFAULT NULL COMMENT '创建人ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater_id` bigint(20) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` datetime DEFAULT NULL COMMENT '软删除时间',
  `version` int(11) DEFAULT 1 COMMENT '乐观锁版本号',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`) COMMENT '用户名唯一索引',
  UNIQUE KEY `uk_email` (`email`) COMMENT '邮箱唯一索引',
  UNIQUE KEY `uk_phone` (`phone`) COMMENT '手机号唯一索引',
  KEY `idx_status` (`status`) COMMENT '状态索引',
  KEY `idx_created_at` (`created_at`) COMMENT '创建时间索引',
  KEY `idx_deleted_at` (`deleted_at`) COMMENT '软删除索引',
  KEY `idx_creator_id` (`creator_id`) COMMENT '创建人索引',
  KEY `idx_updater_id` (`updater_id`) COMMENT '更新人索引',
  CONSTRAINT `fk_user_creator` FOREIGN KEY (`creator_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_user_updater` FOREIGN KEY (`updater_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 复合索引：状态+创建时间（用于分页查询）
CREATE INDEX `idx_status_created` ON `sys_user` (`status`, `created_at`);

-- 复合索引：真实姓名+状态（用于搜索）
CREATE INDEX `idx_real_name_status` ON `sys_user` (`real_name`, `status`);

SET FOREIGN_KEY_CHECKS = 1;