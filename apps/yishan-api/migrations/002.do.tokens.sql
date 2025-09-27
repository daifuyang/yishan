-- 用户令牌表设计
-- 创建时间：2025年01月27日
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_user_token
-- ----------------------------
CREATE TABLE IF NOT EXISTS `sys_user_token` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '令牌ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `access_token` text NOT NULL COMMENT '访问令牌',
  `refresh_token` text NOT NULL COMMENT '刷新令牌',
  `access_token_expires_at` datetime NOT NULL COMMENT '访问令牌过期时间',
  `refresh_token_expires_at` datetime NOT NULL COMMENT '刷新令牌过期时间',
  `token_type` varchar(20) DEFAULT 'Bearer' COMMENT '令牌类型',
  `client_ip` varchar(45) DEFAULT NULL COMMENT '客户端IP',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '用户代理',
  `is_revoked` tinyint(1) DEFAULT 0 COMMENT '是否已撤销(0-否,1-是)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `revoked_at` datetime DEFAULT NULL COMMENT '撤销时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`) COMMENT '用户ID索引',
  KEY `idx_access_token_expires` (`access_token_expires_at`) COMMENT '访问令牌过期时间索引',
  KEY `idx_refresh_token_expires` (`refresh_token_expires_at`) COMMENT '刷新令牌过期时间索引',
  KEY `idx_is_revoked` (`is_revoked`) COMMENT '撤销状态索引',
  KEY `idx_created_at` (`created_at`) COMMENT '创建时间索引',
  CONSTRAINT `fk_token_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户令牌表';

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 复合索引：用户ID+撤销状态（用于查询用户有效令牌）
CREATE INDEX `idx_user_revoked` ON `sys_user_token` (`user_id`, `is_revoked`);

-- 复合索引：用户ID+访问令牌过期时间（用于清理过期令牌）
CREATE INDEX `idx_user_access_expires` ON `sys_user_token` (`user_id`, `access_token_expires_at`);

-- 复合索引：用户ID+刷新令牌过期时间（用于清理过期令牌）
CREATE INDEX `idx_user_refresh_expires` ON `sys_user_token` (`user_id`, `refresh_token_expires_at`);

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;