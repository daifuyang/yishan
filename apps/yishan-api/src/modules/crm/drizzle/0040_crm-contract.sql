-- Phase 3: crm_contract 合同主表。

CREATE TABLE `crm_contract` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contract_no` varchar(32) NOT NULL,
	`name` varchar(200) NOT NULL,
	`customer_id` int NOT NULL,
	`opportunity_id` int,
	`quotation_id` int,
	`amount_cents` bigint NOT NULL DEFAULT 0,
	`signed_at` datetime,
	`effective_at` datetime,
	`expires_at` datetime,
	`status` varchar(32) NOT NULL DEFAULT 'draft',
	`owner_user_id` int,
	`owner_department_id` int,
	`attachment_ids` json,
	`description` varchar(2000),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_contract_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_contract_no` UNIQUE(`contract_no`)
);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_customer_id` ON `crm_contract` (`customer_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_opportunity_id` ON `crm_contract` (`opportunity_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_quotation_id` ON `crm_contract` (`quotation_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_owner_user_id` ON `crm_contract` (`owner_user_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_status` ON `crm_contract` (`status`);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_customer_status` ON `crm_contract` (`customer_id`, `status`);
--> statement-breakpoint

CREATE INDEX `idx_crm_contract_deleted_at` ON `crm_contract` (`deleted_at`);
