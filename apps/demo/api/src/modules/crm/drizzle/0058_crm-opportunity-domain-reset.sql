ALTER TABLE `crm_opportunity`
  RENAME COLUMN `contact_id` TO `primary_contact_id`,
  RENAME COLUMN `owner_user_id` TO `owner_id`,
  RENAME COLUMN `stage_code` TO `stage`,
  RENAME COLUMN `expected_amount_cents` TO `amount_cents`,
  RENAME COLUMN `lost_reason_code` TO `lost_reason`;

UPDATE `crm_opportunity`
SET `stage` = CASE
  WHEN `stage` IN ('discover', 'qualify', 'initial', 'contact', 'followup') THEN 'requirement'
  WHEN `stage` IN ('quotation') THEN 'proposal'
  WHEN `stage` IN ('contract', 'success') THEN 'won'
  ELSE `stage`
END;

UPDATE `crm_opportunity_stage_log`
SET `from_stage` = CASE WHEN `from_stage` IN ('discover', 'qualify', 'initial', 'contact', 'followup') THEN 'requirement' WHEN `from_stage` = 'quotation' THEN 'proposal' WHEN `from_stage` IN ('contract', 'success') THEN 'won' ELSE `from_stage` END,
    `to_stage` = CASE WHEN `to_stage` IN ('discover', 'qualify', 'initial', 'contact', 'followup') THEN 'requirement' WHEN `to_stage` = 'quotation' THEN 'proposal' WHEN `to_stage` IN ('contract', 'success') THEN 'won' ELSE `to_stage` END;

ALTER TABLE `crm_opportunity`
  DROP COLUMN `pipeline_code`,
  DROP COLUMN `scope`,
  DROP COLUMN `next_action_at`,
  DROP INDEX `idx_crm_opportunity_contact_id`,
  DROP INDEX `idx_crm_opportunity_owner_stage`,
  DROP INDEX `idx_crm_opportunity_customer_stage`,
  DROP INDEX `idx_crm_opportunity_pipeline_stage`,
  DROP INDEX `idx_crm_opportunity_pipeline_stage_entered`,
  DROP INDEX `idx_crm_opportunity_stage`,
  DROP INDEX `idx_crm_opportunity_next_action_at`;

ALTER TABLE `crm_opportunity`
  ADD INDEX `idx_crm_opportunity_primary_contact_id` (`primary_contact_id`),
  ADD INDEX `idx_crm_opportunity_owner_stage` (`owner_id`, `stage`),
  ADD INDEX `idx_crm_opportunity_customer_stage` (`customer_id`, `stage`),
  ADD INDEX `idx_crm_opportunity_stage` (`stage`),
  ALTER COLUMN `stage` SET DEFAULT 'requirement';

CREATE TABLE `crm_opportunity_product_intent` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opportunity_id` int NOT NULL,
  `product_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_crm_opportunity_product_intent` (`opportunity_id`, `product_id`),
  KEY `idx_crm_opportunity_product_intent_opportunity` (`opportunity_id`),
  KEY `idx_crm_opportunity_product_intent_product` (`product_id`)
);
