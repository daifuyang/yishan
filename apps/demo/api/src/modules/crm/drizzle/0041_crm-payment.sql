-- Phase 3: crm_payment_plan / crm_payment_actual / crm_payment_writeoff。

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
	CONSTRAINT `crm_payment_plan_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_plan_contract_id` ON `crm_payment_plan` (`contract_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_plan_planned_date` ON `crm_payment_plan` (`planned_date`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_plan_status` ON `crm_payment_plan` (`status`);
--> statement-breakpoint

CREATE UNIQUE INDEX `uniq_crm_payment_plan_contract_period` ON `crm_payment_plan` (`contract_id`, `period_no`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_plan_deleted_at` ON `crm_payment_plan` (`deleted_at`);
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

CREATE INDEX `idx_crm_payment_actual_contract_id` ON `crm_payment_actual` (`contract_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_actual_received_at` ON `crm_payment_actual` (`received_at`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_actual_method_code` ON `crm_payment_actual` (`method_code`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_actual_deleted_at` ON `crm_payment_actual` (`deleted_at`);
--> statement-breakpoint

CREATE TABLE `crm_payment_writeoff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actual_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`amount_cents` bigint NOT NULL DEFAULT 0,
	`operator_user_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_payment_writeoff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_writeoff_actual_id` ON `crm_payment_writeoff` (`actual_id`);
--> statement-breakpoint

CREATE INDEX `idx_crm_payment_writeoff_plan_id` ON `crm_payment_writeoff` (`plan_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `uniq_crm_payment_writeoff_actual_plan` ON `crm_payment_writeoff` (`actual_id`, `plan_id`);
