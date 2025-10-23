-- 企业级角色表设计
-- 创建时间：2025年10月10日
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_role
-- ----------------------------
CREATE TABLE `sys_role` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `role_name` varchar(100) NOT NULL COMMENT '角色名称',
  `role_desc` varchar(255) DEFAULT NULL COMMENT '角色描述',
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  `is_system` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为系统角色：0-否，1-是',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序顺序，数值越小越靠前',
  `creator_id` bigint(20) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater_id` bigint(20) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`role_name`),
  KEY `idx_status` (`status`),
  KEY `idx_is_system` (`is_system`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_sys_role_creator` FOREIGN KEY (`creator_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sys_role_updater` FOREIGN KEY (`updater_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统角色表';

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 复合索引：状态+创建时间（用于角色列表查询）
CREATE INDEX `idx_status_created_at` ON `sys_role` (`status`, `created_at`);

-- ----------------------------
-- 插入系统默认角色
-- ----------------------------
INSERT INTO `sys_role` (`role_name`, `role_desc`, `is_system`, `sort_order`, `created_at`) VALUES
('超级管理员', '系统超级管理员，拥有所有权限', 1, 1, NOW()),
('管理员', '系统管理员，拥有大部分管理权限', 1, 2, NOW()),
('普通用户', '普通用户，拥有基础功能权限', 1, 3, NOW());

-- ----------------------------
-- Table structure for sys_user_role
-- ----------------------------
CREATE TABLE `sys_user_role` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `user_id` bigint(20) NOT NULL COMMENT '用户ID',
  `role_id` bigint(20) NOT NULL COMMENT '角色ID',
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  `creator_id` bigint(20) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater_id` bigint(20) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `assigned_at` timestamp NULL DEFAULT NULL COMMENT '分配时间',
  `expires_at` timestamp NULL DEFAULT NULL COMMENT '过期时间',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`) REFERENCES `sys_role` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_creator` FOREIGN KEY (`creator_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_role_updater` FOREIGN KEY (`updater_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- ----------------------------
-- 创建用户角色关联表索引优化
-- ----------------------------
-- 复合索引：用户ID+状态（用于查询用户有效角色）
CREATE INDEX `idx_user_status` ON `sys_user_role` (`user_id`, `status`);

-- 复合索引：角色ID+状态（用于查询角色下的用户）
CREATE INDEX `idx_role_status` ON `sys_user_role` (`role_id`, `status`);

-- 过期时间索引（用于查询过期的用户角色）
CREATE INDEX `idx_expires_at` ON `sys_user_role` (`expires_at`);

-- 复合索引：用户ID+过期时间（用于查询用户未过期的角色）
CREATE INDEX `idx_user_expires` ON `sys_user_role` (`user_id`, `expires_at`);

-- 复合索引：角色ID+过期时间（用于查询角色下未过期的用户）
CREATE INDEX `idx_role_expires` ON `sys_user_role` (`role_id`, `expires_at`);

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;