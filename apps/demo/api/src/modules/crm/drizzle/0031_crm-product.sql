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
CREATE INDEX `idx_crm_product_category_parent_code` ON `crm_product_category` (`parent_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_deleted_at` ON `crm_product_category` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_enabled` ON `crm_product_category` (`enabled`);--> statement-breakpoint
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
CREATE INDEX `idx_crm_unit_deleted_at` ON `crm_unit` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_unit_enabled` ON `crm_unit` (`enabled`);--> statement-breakpoint
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
CREATE INDEX `idx_crm_product_name` ON `crm_product` (`name`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_category_code` ON `crm_product` (`category_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_unit_code` ON `crm_product` (`unit_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_enabled` ON `crm_product` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_crm_product_deleted_at` ON `crm_product` (`deleted_at`);