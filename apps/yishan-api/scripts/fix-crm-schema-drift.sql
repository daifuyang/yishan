-- fix-crm-schema-drift.sql
--
-- 一次性把当前 `all` 分支代码假设的 schema 拉到本地 mysql-local。
-- 由 compare-crm-schema-vs-db.mjs 产出 diff；本文件手工对齐 schema.ts。
--
-- 幂等设计：
--   - 加列：先查 information_schema.COLUMNS，缺才 ADD（避免重复列）。
--   - 加索引：先 DROP 同名（若存在但列定义不同），再 CREATE。
--   - 建表：CREATE TABLE IF NOT EXISTS。
--
-- 已存在数据不会被破坏。

-- ============================================================================
-- 1. crm_opportunity: 补齐 schema.ts 声明但 DB 缺的列 + 索引
-- ============================================================================
-- contact_id
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='contact_id');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `contact_id` int AFTER `customer_id`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- owner_user_id
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='owner_user_id');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `owner_user_id` int AFTER `contact_id`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pipeline_code
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='pipeline_code');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `pipeline_code` varchar(64) NOT NULL DEFAULT ''default'' AFTER `owner_department_id`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- stage_code
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='stage_code');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `stage_code` varchar(64) NOT NULL DEFAULT ''discover'' AFTER `pipeline_code`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expected_amount_cents
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='expected_amount_cents');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `expected_amount_cents` bigint NOT NULL DEFAULT 0 AFTER `stage_entered_at`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- next_action_at
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='next_action_at');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `next_action_at` datetime AFTER `expected_close_date`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lost_reason_code
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND COLUMN_NAME='lost_reason_code');
SET @s := IF(@c=0, 'ALTER TABLE `crm_opportunity` ADD COLUMN `lost_reason_code` varchar(64) AFTER `next_action_at`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 索引：DB 已存在同名但指向旧列的索引，先 DROP 再 CREATE 到正确列
-- idx_crm_opportunity_owner_stage  → owner_user_id + stage_code
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_owner_stage'
             AND COLUMN_NAME IN ('owner_id', 'stage'));
SET @s := IF(@c > 0, 'DROP INDEX `idx_crm_opportunity_owner_stage` ON `crm_opportunity`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE INDEX `idx_crm_opportunity_owner_stage` ON `crm_opportunity` (`owner_user_id`, `stage_code`);

-- idx_crm_opportunity_contact_id（之前 PARTIAL ALTER 已建，这里跳过）
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_contact_id');
SET @s := IF(@c=0, 'CREATE INDEX `idx_crm_opportunity_contact_id` ON `crm_opportunity` (`contact_id`)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_crm_opportunity_pipeline_stage
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_pipeline_stage');
SET @s := IF(@c=0, 'CREATE INDEX `idx_crm_opportunity_pipeline_stage` ON `crm_opportunity` (`pipeline_code`, `stage_code`)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_crm_opportunity_stage（DB 已有同名索引指向 stage 列；列名仍叫 stage，先 DROP 再用 stage_code 重命名列）
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_stage'
             AND COLUMN_NAME='stage');
SET @s := IF(@c > 0, 'DROP INDEX `idx_crm_opportunity_stage` ON `crm_opportunity`', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_stage');
SET @s := IF(@c=0, 'CREATE INDEX `idx_crm_opportunity_stage` ON `crm_opportunity` (`stage_code`)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_crm_opportunity_next_action_at
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_next_action_at');
SET @s := IF(@c=0, 'CREATE INDEX `idx_crm_opportunity_next_action_at` ON `crm_opportunity` (`next_action_at`)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_crm_opportunity_pipeline_stage_entered (schema L711)
SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_opportunity' AND INDEX_NAME='idx_crm_opportunity_pipeline_stage_entered');
SET @s := IF(@c=0, 'CREATE INDEX `idx_crm_opportunity_pipeline_stage_entered` ON `crm_opportunity` (`pipeline_code`, `stage_code`, `stage_entered_at`)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 2. crm_lead: 线索主表（schema.ts L96-135）
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crm_lead` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(100),
  `company_name` varchar(200),
  `mobile` varchar(32),
  `phone` varchar(32),
  `email` varchar(100),
  `wechat` varchar(64),
  `qq` varchar(32),
  `source_id` int,
  `intention` varchar(2000),
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `owner_user_id` int,
  `owner_department_id` int,
  `last_follow_up_at` datetime,
  `next_follow_up_at` datetime,
  `disqualify_reason` varchar(500),
  `disqualify_code` varchar(32),
  `converted_customer_id` int,
  `converted_contact_id` int,
  `converted_at` datetime,
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updater_id` int,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` datetime,
  CONSTRAINT `crm_lead_id` PRIMARY KEY(`id`)
);
CREATE INDEX `idx_crm_lead_status` ON `crm_lead` (`status`);
CREATE INDEX `idx_crm_lead_owner` ON `crm_lead` (`owner_user_id`, `owner_department_id`);
CREATE INDEX `idx_crm_lead_mobile` ON `crm_lead` (`mobile`);
CREATE INDEX `idx_crm_lead_email` ON `crm_lead` (`email`);
CREATE INDEX `idx_crm_lead_next_follow_up_at` ON `crm_lead` (`next_follow_up_at`);
CREATE INDEX `idx_crm_lead_deleted_at` ON `crm_lead` (`deleted_at`);
CREATE INDEX `idx_crm_lead_disqualify_code` ON `crm_lead` (`disqualify_code`);

-- ============================================================================
-- 3. crm_lead_activity: 线索跟进（schema.ts L138-156）
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crm_lead_activity` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lead_id` int NOT NULL,
  `type` varchar(16) NOT NULL,
  `content` varchar(2000) NOT NULL DEFAULT '',
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `next_follow_up_at` datetime,
  `operator_user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  CONSTRAINT `crm_lead_activity_id` PRIMARY KEY(`id`)
);
CREATE INDEX `idx_crm_lead_activity_lead_id` ON `crm_lead_activity` (`lead_id`);
CREATE INDEX `idx_crm_lead_activity_operator_user_id` ON `crm_lead_activity` (`operator_user_id`);
CREATE INDEX `idx_crm_lead_activity_lead_occurred` ON `crm_lead_activity` (`lead_id`, `occurred_at`);

-- ============================================================================
-- 4. crm_payment_plan: 合同回款计划（schema.ts L808-832）
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crm_payment_plan` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contract_id` int NOT NULL,
  `period_no` int NOT NULL,
  `planned_date` datetime NOT NULL,
  `planned_amount_cents` bigint NOT NULL DEFAULT 0,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `remark` varchar(500),
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updater_id` int,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` datetime,
  CONSTRAINT `crm_payment_plan_id` PRIMARY KEY(`id`),
  CONSTRAINT `uniq_crm_payment_plan_contract_period` UNIQUE(`contract_id`, `period_no`)
);
CREATE INDEX `idx_crm_payment_plan_contract_id` ON `crm_payment_plan` (`contract_id`);
CREATE INDEX `idx_crm_payment_plan_planned_date` ON `crm_payment_plan` (`planned_date`);
CREATE INDEX `idx_crm_payment_plan_status` ON `crm_payment_plan` (`status`);
CREATE INDEX `idx_crm_payment_plan_deleted_at` ON `crm_payment_plan` (`deleted_at`);

-- ============================================================================
-- 5. crm_payment_actual: 实际回款（schema.ts L840-861）
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crm_payment_actual` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contract_id` int NOT NULL,
  `received_at` datetime NOT NULL,
  `amount_cents` bigint NOT NULL DEFAULT 0,
  `method_code` varchar(64) NOT NULL,
  `operator_user_id` int NOT NULL,
  `remark` varchar(500),
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` datetime,
  CONSTRAINT `crm_payment_actual_id` PRIMARY KEY(`id`)
);
CREATE INDEX `idx_crm_payment_actual_contract_id` ON `crm_payment_actual` (`contract_id`);
CREATE INDEX `idx_crm_payment_actual_received_at` ON `crm_payment_actual` (`received_at`);
CREATE INDEX `idx_crm_payment_actual_method_code` ON `crm_payment_actual` (`method_code`);
CREATE INDEX `idx_crm_payment_actual_deleted_at` ON `crm_payment_actual` (`deleted_at`);

-- ============================================================================
-- 6. crm_payment_writeoff: 回款核销桥接（schema.ts L869-884）
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crm_payment_writeoff` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actual_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `amount_cents` bigint NOT NULL DEFAULT 0,
  `operator_user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  CONSTRAINT `crm_payment_writeoff_id` PRIMARY KEY(`id`),
  CONSTRAINT `uniq_crm_payment_writeoff_actual_plan` UNIQUE(`actual_id`, `plan_id`)
);
CREATE INDEX `idx_crm_payment_writeoff_actual_id` ON `crm_payment_writeoff` (`actual_id`);
CREATE INDEX `idx_crm_payment_writeoff_plan_id` ON `crm_payment_writeoff` (`plan_id`);

-- ============================================================================
-- 7. crm_ticket: 工单（schema.ts L469-502）
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crm_ticket` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ticket_no` varchar(32) NOT NULL,
  `title` varchar(200) NOT NULL,
  `customer_id` int NOT NULL,
  `contact_id` int,
  `contract_id` int,
  `product_id` int,
  `type_code` varchar(64) NOT NULL,
  `priority_code` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'open',
  `owner_user_id` int,
  `sla_due_at` datetime,
  `description` varchar(2000),
  `solution` varchar(2000),
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updater_id` int,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `closed_at` datetime,
  `deleted_at` datetime,
  CONSTRAINT `crm_ticket_id` PRIMARY KEY(`id`),
  CONSTRAINT `uniq_crm_ticket_no` UNIQUE(`ticket_no`)
);
CREATE INDEX `idx_crm_ticket_customer_id` ON `crm_ticket` (`customer_id`);
CREATE INDEX `idx_crm_ticket_owner_user_id` ON `crm_ticket` (`owner_user_id`);
CREATE INDEX `idx_crm_ticket_status` ON `crm_ticket` (`status`);
CREATE INDEX `idx_crm_ticket_type_code` ON `crm_ticket` (`type_code`);
CREATE INDEX `idx_crm_ticket_priority_code` ON `crm_ticket` (`priority_code`);
CREATE INDEX `idx_crm_ticket_deleted_at` ON `crm_ticket` (`deleted_at`);