-- Phase 1: crm_activity polymorphic 化。
-- 新增 entity_type / entity_id 联合列；crm_lead_activity 数据由 service 双写到 crm_activity(type='lead_followup')。
-- Phase 1 完成后，旧 crm_lead_activity 仍保留（service 兼容读），最后一步允许 drop。

ALTER TABLE `crm_activity`
  ADD COLUMN `entity_type` varchar(32) AFTER `contact_id`,
  ADD COLUMN `entity_id` int AFTER `entity_type`,
  ADD COLUMN `entity_ref_type` varchar(32) AFTER `entity_id`;
--> statement-breakpoint

-- 数据迁移：把旧 customer_id 列的数据同步到 entity_type='customer' + entity_id=customer_id
UPDATE `crm_activity`
  SET `entity_type` = 'customer', `entity_id` = `customer_id`, `entity_ref_type` = 'customer'
  WHERE `entity_type` IS NULL AND `customer_id` IS NOT NULL;
--> statement-breakpoint

CREATE INDEX `idx_crm_activity_entity` ON `crm_activity` (`entity_type`, `entity_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX `idx_crm_activity_type` ON `crm_activity` (`type`);
