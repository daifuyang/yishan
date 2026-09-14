-- CRM V0.1 keeps crm_customer as the only pre-sale aggregate.
DELETE FROM `crm_activity` WHERE `entity_type` = 'lead';
--> statement-breakpoint

DROP TABLE IF EXISTS `crm_lead_activity`;
--> statement-breakpoint
DROP TABLE IF EXISTS `crm_lead`;
--> statement-breakpoint
DROP TABLE IF EXISTS `crm_payment_writeoff`;
--> statement-breakpoint
DROP TABLE IF EXISTS `crm_payment_actual`;
--> statement-breakpoint
DROP TABLE IF EXISTS `crm_payment_plan`;
--> statement-breakpoint
DROP TABLE IF EXISTS `crm_ticket`;
--> statement-breakpoint

UPDATE `crm_customer`
SET `status_code` = 'potential'
WHERE `status_code` IS NULL
   OR `status_code` NOT IN ('potential', 'following', 'opportunity', 'customer', 'lost');
--> statement-breakpoint

ALTER TABLE `crm_customer`
  MODIFY COLUMN `status_code` varchar(64) NOT NULL DEFAULT 'potential';
--> statement-breakpoint

DELETE FROM `sys_enum`
WHERE `type` = 'crm_lead_status'
   OR (`type` = 'crm_customer_status' AND `code` NOT IN ('potential', 'following', 'opportunity', 'customer', 'lost'))
   OR (`type` = 'crm_opportunity_stage' AND `code` NOT IN ('discover', 'qualify', 'proposal', 'negotiation', 'won'));
--> statement-breakpoint

CREATE TABLE `crm_payment` (
  `id` int AUTO_INCREMENT NOT NULL,
  `contract_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `amount_cents` bigint NOT NULL DEFAULT 0,
  `paid_at` datetime NOT NULL,
  `method_code` varchar(64) NOT NULL,
  `remark` varchar(500),
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updater_id` int,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` datetime,
  CONSTRAINT `crm_payment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_payment_contract_id` ON `crm_payment` (`contract_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_payment_customer_id` ON `crm_payment` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_payment_paid_at` ON `crm_payment` (`paid_at`);
--> statement-breakpoint
CREATE INDEX `idx_crm_payment_method_code` ON `crm_payment` (`method_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_payment_deleted_at` ON `crm_payment` (`deleted_at`);
--> statement-breakpoint

CREATE TABLE `crm_task` (
  `id` int AUTO_INCREMENT NOT NULL,
  `customer_id` int NOT NULL,
  `title` varchar(200) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'todo',
  `assignee_user_id` int,
  `due_at` datetime,
  `completed_at` datetime,
  `description` varchar(2000),
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updater_id` int,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` datetime,
  CONSTRAINT `crm_task_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_task_customer_id` ON `crm_task` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_task_assignee_status` ON `crm_task` (`assignee_user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_crm_task_due_at` ON `crm_task` (`due_at`);
--> statement-breakpoint
CREATE INDEX `idx_crm_task_deleted_at` ON `crm_task` (`deleted_at`);
--> statement-breakpoint

CREATE TABLE `crm_attachment` (
  `id` int AUTO_INCREMENT NOT NULL,
  `customer_id` int NOT NULL,
  `entity_type` varchar(32) NOT NULL,
  `entity_id` int NOT NULL,
  `attachment_id` int NOT NULL,
  `creator_id` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  CONSTRAINT `crm_attachment_id` PRIMARY KEY(`id`),
  CONSTRAINT `uniq_crm_attachment_attachment_id` UNIQUE(`attachment_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_attachment_customer_id` ON `crm_attachment` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_attachment_entity` ON `crm_attachment` (`entity_type`, `entity_id`);
