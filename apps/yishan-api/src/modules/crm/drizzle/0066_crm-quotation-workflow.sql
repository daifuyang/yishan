ALTER TABLE `crm_quotation` ADD COLUMN `quote_date` datetime NULL;
--> statement-breakpoint
UPDATE `crm_quotation` SET `quote_date` = `created_at` WHERE `quote_date` IS NULL;
--> statement-breakpoint
ALTER TABLE `crm_quotation_item` ADD COLUMN `description` varchar(2000) NULL;
