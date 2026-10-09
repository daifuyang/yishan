ALTER TABLE `crm_quotation`
  ADD COLUMN `root_quote_id` int NULL,
  ADD COLUMN `source_quote_id` int NULL;
--> statement-breakpoint
-- 不猜测旧数据间的来源关系，每张已有报价成为独立系列。
UPDATE `crm_quotation` SET `root_quote_id` = `id`;
--> statement-breakpoint
ALTER TABLE `crm_quotation`
  ADD UNIQUE KEY `uniq_crm_quotation_root_version` (`root_quote_id`, `version`),
  ADD KEY `idx_crm_quotation_source_quote_id` (`source_quote_id`);
