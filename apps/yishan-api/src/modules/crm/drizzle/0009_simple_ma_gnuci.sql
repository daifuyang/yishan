CREATE TABLE `crm_customer_member` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'collaborator',
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_customer_member_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_customer_member` UNIQUE(`customer_id`,`user_id`)
);
--> statement-breakpoint
DROP INDEX `idx_crm_lead_pool_status` ON `crm_lead`;--> statement-breakpoint
ALTER TABLE `crm_activity` MODIFY COLUMN `customer_id` int;--> statement-breakpoint
ALTER TABLE `crm_activity` MODIFY COLUMN `type` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `crm_lead` MODIFY COLUMN `status` varchar(16) NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `entity_type` varchar(32);--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `entity_id` int;--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `entity_ref_type` varchar(32);--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `planned_at` datetime;--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `location` varchar(255);--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `participants` varchar(500);--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `visit_result_code` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `summary` varchar(1000);--> statement-breakpoint
ALTER TABLE `crm_activity` ADD `deleted_at` datetime;--> statement-breakpoint
ALTER TABLE `crm_contact` ADD `role_code` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_contact` ADD `status_code` varchar(64) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `crm_customer` ADD `status_code` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_customer` ADD `source_code` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_customer` ADD `level_code` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_customer` ADD `industry_code` varchar(64);--> statement-breakpoint
ALTER TABLE `crm_customer` ADD `pool_entered_at` datetime;--> statement-breakpoint
CREATE INDEX `idx_crm_customer_member_user_id` ON `crm_customer_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_entity` ON `crm_activity` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_type` ON `crm_activity` (`type`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_planned_at` ON `crm_activity` (`planned_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_deleted_at` ON `crm_activity` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_contact_role_code` ON `crm_contact` (`role_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_contact_status_code` ON `crm_contact` (`status_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_contact_customer_primary` ON `crm_contact` (`customer_id`,`is_primary`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_pool_entered_at` ON `crm_customer` (`pool_entered_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_status_code` ON `crm_customer` (`status_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_source_code` ON `crm_customer` (`source_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_level_code` ON `crm_customer` (`level_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_industry_code` ON `crm_customer` (`industry_code`);--> statement-breakpoint
ALTER TABLE `crm_lead` DROP COLUMN `pool_status`;