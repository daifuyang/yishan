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
ALTER TABLE `crm_activity` ADD `deleted_at` datetime;--> statement-breakpoint
CREATE INDEX `idx_crm_customer_member_user_id` ON `crm_customer_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_deleted_at` ON `crm_activity` (`deleted_at`);