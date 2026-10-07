CREATE TABLE IF NOT EXISTS `crm_business_number` (
  `prefix` varchar(32) NOT NULL,
  `next_value` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`prefix`)
);
--> statement-breakpoint
ALTER TABLE `crm_opportunity`
  ADD COLUMN `opportunity_no` varchar(32) NULL,
  ADD COLUMN `creation_key` varchar(64) NULL;
--> statement-breakpoint
UPDATE `crm_opportunity`
SET `opportunity_no` = CONCAT('OPP-', DATE_FORMAT(`created_at`, '%Y%m'), '-', LPAD(`id`, 4, '0'))
WHERE `opportunity_no` IS NULL;
--> statement-breakpoint
ALTER TABLE `crm_opportunity`
  MODIFY COLUMN `opportunity_no` varchar(32) NOT NULL,
  ADD UNIQUE KEY `uniq_crm_opportunity_no` (`opportunity_no`),
  ADD UNIQUE KEY `uniq_crm_opportunity_creation_key` (`creation_key`);
--> statement-breakpoint
ALTER TABLE `crm_quotation`
  ADD COLUMN `series_id` varchar(36) NULL,
  ADD COLUMN `series_no` varchar(32) NULL;
--> statement-breakpoint
UPDATE `crm_quotation` SET `series_id` = UUID() WHERE `root_quote_id` IS NULL OR `root_quote_id` = `id`;
--> statement-breakpoint
UPDATE `crm_quotation` q
LEFT JOIN `crm_quotation` root ON root.`id` = q.`root_quote_id`
SET q.`series_id` = COALESCE(root.`series_id`, UUID())
WHERE q.`series_id` IS NULL;
--> statement-breakpoint
UPDATE `crm_quotation` q
LEFT JOIN `crm_quotation` root ON root.`id` = q.`root_quote_id`
SET q.`series_no` = LEFT(REGEXP_REPLACE(COALESCE(root.`quotation_no`, q.`quotation_no`), '-R[0-9]+$', ''), 32)
WHERE q.`series_no` IS NULL;
--> statement-breakpoint
ALTER TABLE `crm_quotation`
  MODIFY COLUMN `series_id` varchar(36) NOT NULL,
  MODIFY COLUMN `series_no` varchar(32) NOT NULL,
  ADD UNIQUE KEY `uniq_crm_quotation_series_version` (`series_id`, `version`),
  ADD KEY `idx_crm_quotation_series_id` (`series_id`);
--> statement-breakpoint
UPDATE `crm_quotation`
SET `name` = REPLACE(REPLACE(REPLACE(`name`, '第一版报价', '报价'), '第二版报价', '报价'), '第三版报价', '报价');
