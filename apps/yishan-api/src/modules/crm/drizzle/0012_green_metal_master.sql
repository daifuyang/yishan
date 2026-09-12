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
CREATE TABLE `crm_payment_actual` (
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
--> statement-breakpoint
CREATE TABLE `crm_payment_plan` (
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
	CONSTRAINT `uniq_crm_payment_plan_contract_period` UNIQUE(`contract_id`,`period_no`)
);
--> statement-breakpoint
CREATE TABLE `crm_payment_writeoff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actual_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`amount_cents` bigint NOT NULL DEFAULT 0,
	`operator_user_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_payment_writeoff_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_payment_writeoff_actual_plan` UNIQUE(`actual_id`,`plan_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_contract_customer_id` ON `crm_contract` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_contract_opportunity_id` ON `crm_contract` (`opportunity_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_contract_quotation_id` ON `crm_contract` (`quotation_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_contract_owner_user_id` ON `crm_contract` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_contract_status` ON `crm_contract` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_contract_customer_status` ON `crm_contract` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_contract_deleted_at` ON `crm_contract` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_actual_contract_id` ON `crm_payment_actual` (`contract_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_actual_received_at` ON `crm_payment_actual` (`received_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_actual_method_code` ON `crm_payment_actual` (`method_code`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_actual_deleted_at` ON `crm_payment_actual` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_plan_contract_id` ON `crm_payment_plan` (`contract_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_plan_planned_date` ON `crm_payment_plan` (`planned_date`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_plan_status` ON `crm_payment_plan` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_plan_deleted_at` ON `crm_payment_plan` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_writeoff_actual_id` ON `crm_payment_writeoff` (`actual_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_payment_writeoff_plan_id` ON `crm_payment_writeoff` (`plan_id`);