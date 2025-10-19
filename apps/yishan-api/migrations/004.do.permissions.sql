-- 企业级权限表设计
-- 创建时间：2025年10月10日
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_permission
-- ----------------------------
CREATE TABLE `sys_permission` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '权限ID',
  `parent_id` bigint(20) DEFAULT 0 COMMENT '父权限ID（0表示顶级权限）',
  `permission_name` varchar(100) NOT NULL COMMENT '权限名称',
  `permission_desc` varchar(500) DEFAULT NULL COMMENT '权限描述',
  `permission_type` tinyint(1) NOT NULL DEFAULT 1 COMMENT '权限类型：1-菜单，2-按钮，3-接口',
  `resource_url` varchar(500) DEFAULT NULL COMMENT '资源URL（菜单路径或接口地址）',
  `resource_method` varchar(10) DEFAULT NULL COMMENT '请求方法（GET,POST,PUT,DELETE等）',
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序顺序',
  `creator_id` bigint(20) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater_id` bigint(20) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_permission_type` (`permission_type`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_permission_creator` FOREIGN KEY (`creator_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_permission_updater` FOREIGN KEY (`updater_id`) REFERENCES `sys_user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 复合索引：父权限ID+状态+排序（用于构建权限树）
CREATE INDEX `idx_parent_status_sort` ON `sys_permission` (`parent_id`, `status`, `sort_order`);

-- 复合索引：权限类型+状态（用于按类型筛选权限）
CREATE INDEX `idx_type_status` ON `sys_permission` (`permission_type`, `status`);
-- ----------------------------
-- 插入系统默认权限
-- ----------------------------
INSERT INTO `sys_permission` (`parent_id`, `permission_name`, `permission_desc`, `permission_type`, `resource_url`, `resource_method`, `status`, `sort_order`, `created_at`) VALUES
-- 系统管理模块
(0, '系统管理', '系统管理模块', 1, '/system', NULL, 1, 1, NOW()),
(1, '用户管理', '用户管理功能', 1, '/system/user', NULL, 1, 1, NOW()),
(1, '角色管理', '角色管理功能', 1, '/system/role', NULL, 1, 2, NOW()),
(1, '权限管理', '权限管理功能', 1, '/system/permission', NULL, 1, 3, NOW()),

-- 用户管理权限
(2, '用户列表', '查看用户列表', 3, '/api/v1/admin/users', 'GET', 1, 1, NOW()),
(2, '创建用户', '创建新用户', 3, '/api/v1/admin/users', 'POST', 1, 2, NOW()),
(2, '更新用户', '更新用户信息', 3, '/api/v1/admin/users/*', 'PUT', 1, 3, NOW()),
(2, '删除用户', '删除用户', 3, '/api/v1/admin/users/*', 'DELETE', 1, 4, NOW()),

-- 角色管理权限
(3, '角色列表', '查看角色列表', 3, '/api/v1/admin/roles', 'GET', 1, 1, NOW()),
(3, '创建角色', '创建新角色', 3, '/api/v1/admin/roles', 'POST', 1, 2, NOW()),
(3, '更新角色', '更新角色信息', 3, '/api/v1/admin/roles/*', 'PUT', 1, 3, NOW()),
(3, '删除角色', '删除角色', 3, '/api/v1/admin/roles/*', 'DELETE', 1, 4, NOW()),

-- 权限管理权限
(4, '权限列表', '查看权限列表', 3, '/api/v1/admin/permissions', 'GET', 1, 1, NOW()),
(4, '创建权限', '创建新权限', 3, '/api/v1/admin/permissions', 'POST', 1, 2, NOW()),
(4, '更新权限', '更新权限信息', 3, '/api/v1/admin/permissions/*', 'PUT', 1, 3, NOW()),
(4, '删除权限', '删除权限', 3, '/api/v1/admin/permissions/*', 'DELETE', 1, 4, NOW());

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;