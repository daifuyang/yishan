ALTER TABLE `crm_lead` ADD `pool_status` varchar(16) NOT NULL DEFAULT 'owned';--> statement-breakpoint
UPDATE `crm_lead` SET `pool_status` = 'public' WHERE `owner_user_id` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_crm_lead_pool_status` ON `crm_lead` (`pool_status`);