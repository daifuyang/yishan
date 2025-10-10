-- 企业级角色权限关联表设计
-- 创建时间：2025年10月10日
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_role_permission
-- ----------------------------
CREATE TABLE `sys_role_permission` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `role_id` bigint(20) NOT NULL COMMENT '角色ID',
  `permission_id` bigint(20) NOT NULL COMMENT '权限ID',
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  `creator_id` bigint(20) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater_id` bigint(20) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`, `permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_role_permission_role` FOREIGN KEY (`role_id`) REFERENCES `sys_role` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permission_permission` FOREIGN KEY (`permission_id`) REFERENCES `sys_permission` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permission_creator` FOREIGN KEY (`creator_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_role_permission_updater` FOREIGN KEY (`updater_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 复合索引：角色ID+状态（用于查询角色权限）
CREATE INDEX `idx_role_status` ON `sys_role_permission` (`role_id`, `status`);

-- 复合索引：权限ID+状态（用于查询权限所属角色）
CREATE INDEX `idx_permission_status` ON `sys_role_permission` (`permission_id`, `status`);

-- ----------------------------
-- 插入系统默认角色权限关联
-- ----------------------------
-- 超级管理员拥有所有权限
INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `status`, `created_at`)
SELECT 
    (SELECT id FROM sys_role WHERE role_name = '超级管理员') as role_id,
    p.id as permission_id,
    1 as status,
    NOW() as created_at
FROM sys_permission p
WHERE p.status = 1;

-- 系统管理员拥有系统管理相关权限（除了删除权限）
INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `status`, `created_at`)
SELECT 
    (SELECT id FROM sys_role WHERE role_name = '管理员') as role_id,
    p.id as permission_id,
    1 as status,
    NOW() as created_at
FROM sys_permission p
WHERE p.status = 1 
  AND p.permission_name NOT LIKE '%删除%';

-- 普通用户只有基础查看权限
INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `status`, `created_at`)
SELECT 
    (SELECT id FROM sys_role WHERE role_name = '普通用户') as role_id,
    p.id as permission_id,
    1 as status,
    NOW() as created_at
FROM sys_permission p
WHERE p.status = 1 
  AND p.permission_name LIKE '%列表%';

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;