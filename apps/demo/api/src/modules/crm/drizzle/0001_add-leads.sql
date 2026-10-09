CREATE TABLE `crm_lead` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100),
	`company_name` varchar(200),
	`mobile` varchar(32),
	`phone` varchar(32),
	`email` varchar(100),
	`source_id` int,
	`intention` varchar(2000),
	`status` varchar(16) NOT NULL DEFAULT 'new',
	`owner_user_id` int,
	`owner_department_id` int,
	`last_follow_up_at` datetime,
	`next_follow_up_at` datetime,
	`disqualify_reason` varchar(500),
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
--> statement-breakpoint
CREATE INDEX `idx_crm_lead_status` ON `crm_lead` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_lead_owner` ON `crm_lead` (`owner_user_id`,`owner_department_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_lead_mobile` ON `crm_lead` (`mobile`);--> statement-breakpoint
CREATE INDEX `idx_crm_lead_email` ON `crm_lead` (`email`);--> statement-breakpoint
CREATE INDEX `idx_crm_lead_next_follow_up_at` ON `crm_lead` (`next_follow_up_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_lead_deleted_at` ON `crm_lead` (`deleted_at`);