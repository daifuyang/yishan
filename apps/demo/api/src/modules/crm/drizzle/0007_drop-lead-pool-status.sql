DROP INDEX `idx_crm_lead_pool_status` ON `crm_lead`;--> statement-breakpoint
ALTER TABLE `crm_lead` DROP COLUMN `pool_status`;
