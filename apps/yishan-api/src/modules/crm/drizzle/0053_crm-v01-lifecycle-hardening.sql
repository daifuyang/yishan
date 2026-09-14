ALTER TABLE `crm_customer` DROP INDEX `idx_crm_customer_status_id`;
--> statement-breakpoint
ALTER TABLE `crm_customer` DROP COLUMN `status_id`;
--> statement-breakpoint
DROP TABLE IF EXISTS `crm_customer_status`;
--> statement-breakpoint
DELETE FROM `sys_enum` WHERE `type` = 'crm_customer_status';
--> statement-breakpoint
ALTER TABLE `crm_contract` DROP INDEX `idx_crm_contract_quotation_id`;
--> statement-breakpoint
ALTER TABLE `crm_contract` ADD CONSTRAINT `uniq_crm_contract_quotation_id` UNIQUE (`quotation_id`);
