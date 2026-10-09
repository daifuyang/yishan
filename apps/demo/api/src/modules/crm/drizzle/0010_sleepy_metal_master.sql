CREATE TABLE `crm_product` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`category_code` varchar(64),
	`unit_code` varchar(64),
	`standard_price_cents` bigint NOT NULL DEFAULT 0,
	`tax_rate_bp` int NOT NULL DEFAULT 0,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`description` varchar(2000),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_product_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_product_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `crm_product_category` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`parent_code` varchar(64),
	`sort` int NOT NULL DEFAULT 0,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_product_category_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_product_category_code` UNIQUE(`code`)
);
--> statement-breakpoint
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
CREATE TABLE `crm_unit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(64) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_unit_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_unit_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_product_name` ON `crm_product` (`name`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_code` ON `crm_product` (`category_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_unit_code` ON `crm_product` (`unit_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_enabled` ON `crm_product` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_deleted_at` ON `crm_product` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_parent_code` ON `crm_product_category` (`parent_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_deleted_at` ON `crm_product_category` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_enabled` ON `crm_product_category` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_crm_ticket_customer_id` ON `crm_ticket` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_ticket_owner_user_id` ON `crm_ticket` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_ticket_status` ON `crm_ticket` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_ticket_type_code` ON `crm_ticket` (`type_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_ticket_priority_code` ON `crm_ticket` (`priority_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_ticket_deleted_at` ON `crm_ticket` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_unit_deleted_at` ON `crm_unit` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_unit_enabled` ON `crm_unit` (`enabled`);