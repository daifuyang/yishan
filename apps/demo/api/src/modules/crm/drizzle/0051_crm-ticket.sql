-- Phase 4：crm_ticket 工单表（仅建表，不挂业务路由）。
-- 任何对 crm_ticket 的引用都会编译期报错（防止误用）。

CREATE TABLE `crm_ticket` (
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
--> statement-breakpoint

CREATE INDEX `idx_crm_ticket_customer_id` ON `crm_ticket` (`customer_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_ticket_owner_user_id` ON `crm_ticket` (`owner_user_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_ticket_status` ON `crm_ticket` (`status`);
--> statement-breakpoint

CREATE INDEX `idx_crm_ticket_type_code` ON `crm_ticket` (`type_code`);
--> statement-breakpoint

CREATE INDEX `idx_crm_ticket_priority_code` ON `crm_ticket` (`priority_code`);
--> statement-breakpoint

CREATE INDEX `idx_crm_ticket_deleted_at` ON `crm_ticket` (`deleted_at`);
