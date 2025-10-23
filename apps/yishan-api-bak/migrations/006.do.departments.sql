-- 企业级部门表设计
-- 创建时间：2025年1月
-- 版本：v1.0
-- 作者：zerocmf-team

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for sys_department
-- ----------------------------
CREATE TABLE `sys_department` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '部门ID',
  `parent_id` bigint(20) NOT NULL DEFAULT 0 COMMENT '父部门ID，0表示顶级部门',
  `dept_name` varchar(100) NOT NULL COMMENT '部门名称',

  `dept_desc` varchar(255) DEFAULT NULL COMMENT '部门描述',
  `dept_type` tinyint(1) NOT NULL DEFAULT 1 COMMENT '部门类型：1-公司，2-部门，3-小组',
  `status` tinyint(1) NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT '排序顺序，数值越小越靠前',
  `leader_id` bigint(20) DEFAULT NULL COMMENT '部门负责人ID',
  `phone` varchar(20) DEFAULT NULL COMMENT '部门电话',
  `email` varchar(100) DEFAULT NULL COMMENT '部门邮箱',
  `address` varchar(255) DEFAULT NULL COMMENT '部门地址',
  `creator_id` bigint(20) DEFAULT NULL COMMENT '创建人ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updater_id` bigint(20) DEFAULT NULL COMMENT '更新人ID',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dept_name_parent` (`dept_name`, `parent_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_status` (`status`),
  KEY `idx_dept_type` (`dept_type`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_leader_id` (`leader_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统部门表';

-- ----------------------------
-- 创建索引优化
-- ----------------------------
-- 复合索引：父部门ID+状态+排序（用于构建部门树）
CREATE INDEX `idx_parent_status_sort` ON `sys_department` (`parent_id`, `status`, `sort_order`);

-- 复合索引：部门类型+状态（用于按类型筛选部门）
CREATE INDEX `idx_type_status` ON `sys_department` (`dept_type`, `status`);

-- 复合索引：状态+创建时间（用于部门列表查询）
CREATE INDEX `idx_status_created_at` ON `sys_department` (`status`, `created_at`);

-- ----------------------------
-- 插入系统默认部门
-- ----------------------------
INSERT INTO `sys_department` (`parent_id`, `dept_name`, `dept_desc`, `dept_type`, `status`, `sort_order`, `created_at`) VALUES
(0, '总公司', '公司总部', 1, 1, 1, NOW()),
(1, '技术部', '技术研发部门', 2, 1, 1, NOW()),
(1, '产品部', '产品管理部门', 2, 1, 2, NOW()),
(1, '运营部', '运营管理部门', 2, 1, 3, NOW()),
(1, '人事部', '人力资源部门', 2, 1, 4, NOW()),
(1, '财务部', '财务管理部门', 2, 1, 5, NOW()),
(2, '前端组', '前端开发小组', 3, 1, 1, NOW()),
(2, '后端组', '后端开发小组', 3, 1, 2, NOW()),
(2, '测试组', '质量保证小组', 3, 1, 3, NOW());

-- ----------------------------
-- 为用户表添加部门关联字段
-- ----------------------------
ALTER TABLE `sys_user` 
ADD COLUMN `dept_id` bigint(20) DEFAULT NULL COMMENT '所属部门ID' AFTER `phone`,
ADD KEY `idx_dept_id` (`dept_id`);

-- 恢复外键检查
SET FOREIGN_KEY_CHECKS = 1;