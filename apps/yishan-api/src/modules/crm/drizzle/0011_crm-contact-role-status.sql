-- Phase 1: 联系人引入 role_code / status_code。
-- role_code → sys_enum(type='crm_contact_role')
-- status_code → sys_enum(type='crm_contact_status')

ALTER TABLE `crm_contact`
  ADD COLUMN `role_code` varchar(64) AFTER `position`,
  ADD COLUMN `status_code` varchar(64) NOT NULL DEFAULT 'active' AFTER `role_code`;
--> statement-breakpoint

CREATE INDEX `idx_crm_contact_role_code` ON `crm_contact` (`role_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_contact_status_code` ON `crm_contact` (`status_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_contact_customer_primary` ON `crm_contact` (`customer_id`, `is_primary`);
