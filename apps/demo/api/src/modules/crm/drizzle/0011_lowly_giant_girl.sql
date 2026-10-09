CREATE TABLE `crm_opportunity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`customer_id` int NOT NULL,
	`contact_id` int,
	`owner_user_id` int,
	`owner_department_id` int,
	`pipeline_code` varchar(64) NOT NULL DEFAULT 'default',
	`stage_code` varchar(64) NOT NULL DEFAULT 'discover',
	`stage_entered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`expected_amount_cents` bigint NOT NULL DEFAULT 0,
	`expected_close_date` datetime,
	`next_action_at` datetime,
	`lost_reason_code` varchar(64),
	`won_at` datetime,
	`lost_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_opportunity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_opportunity_stage_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opportunity_id` int NOT NULL,
	`from_stage` varchar(64) NOT NULL,
	`to_stage` varchar(64) NOT NULL,
	`operator_user_id` int NOT NULL,
	`reason` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_opportunity_stage_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_quotation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_no` varchar(32) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`customer_id` int NOT NULL,
	`opportunity_id` int,
	`contact_id` int,
	`owner_user_id` int NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`valid_until` datetime,
	`net_cents` bigint NOT NULL DEFAULT 0,
	`tax_cents` bigint NOT NULL DEFAULT 0,
	`total_cents` bigint NOT NULL DEFAULT 0,
	`remark` varchar(2000),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`sent_at` datetime,
	`accepted_at` datetime,
	`closed_at` datetime,
	`deleted_at` datetime,
	CONSTRAINT `crm_quotation_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_quotation_no` UNIQUE(`quotation_no`)
);
--> statement-breakpoint
CREATE TABLE `crm_quotation_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_id` int NOT NULL,
	`product_id` int NOT NULL,
	`product_name_snapshot` varchar(200) NOT NULL,
	`unit_snapshot` varchar(64),
	`quantity_cents` int NOT NULL DEFAULT 0,
	`unit_price_cents` bigint NOT NULL DEFAULT 0,
	`discount_bp` int NOT NULL DEFAULT 0,
	`tax_rate_bp` int NOT NULL DEFAULT 0,
	`line_amount_cents` bigint NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_quotation_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_quotation_status_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotation_id` int NOT NULL,
	`from_status` varchar(16) NOT NULL,
	`to_status` varchar(16) NOT NULL,
	`operator_user_id` int NOT NULL,
	`reason` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_quotation_status_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_customer_id` ON `crm_opportunity` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_contact_id` ON `crm_opportunity` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_owner_stage` ON `crm_opportunity` (`owner_user_id`,`stage_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_customer_stage` ON `crm_opportunity` (`customer_id`,`stage_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_pipeline_stage` ON `crm_opportunity` (`pipeline_code`,`stage_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_pipeline_stage_entered` ON `crm_opportunity` (`pipeline_code`,`stage_code`,`stage_entered_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_stage` ON `crm_opportunity` (`stage_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_next_action_at` ON `crm_opportunity` (`next_action_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_deleted_at` ON `crm_opportunity` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_created_at` ON `crm_opportunity` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_stage_log_opportunity_id` ON `crm_opportunity_stage_log` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_stage_log_created_at` ON `crm_opportunity_stage_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_opportunity_stage_log_opportunity_created` ON `crm_opportunity_stage_log` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_customer_id` ON `crm_quotation` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_opportunity_id` ON `crm_quotation` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_contact_id` ON `crm_quotation` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_owner_user_id` ON `crm_quotation` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_status` ON `crm_quotation` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_opportunity_status` ON `crm_quotation` (`opportunity_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_customer_status` ON `crm_quotation` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_created_at` ON `crm_quotation` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_valid_until` ON `crm_quotation` (`valid_until`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_deleted_at` ON `crm_quotation` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_item_quotation_id` ON `crm_quotation_item` (`quotation_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_item_product_id` ON `crm_quotation_item` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_item_quotation_sort` ON `crm_quotation_item` (`quotation_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_status_log_quotation_id` ON `crm_quotation_status_log` (`quotation_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_status_log_created_at` ON `crm_quotation_status_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_quotation_status_log_quotation_created` ON `crm_quotation_status_log` (`quotation_id`,`created_at`);