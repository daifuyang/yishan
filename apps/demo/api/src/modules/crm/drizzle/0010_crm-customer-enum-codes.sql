-- Phase 0: crm_customer 引入 sys_enum 字典外键列；Phase 1 启用。
-- 旧列 statusId / sourceId / level / industry 保留双写一段时间，最后一步允许 drop。

ALTER TABLE `crm_customer`
  ADD COLUMN `status_code` varchar(64) AFTER `industry`,
  ADD COLUMN `source_code` varchar(64) AFTER `status_code`,
  ADD COLUMN `level_code` varchar(64) AFTER `source_code`,
  ADD COLUMN `industry_code` varchar(64) AFTER `level_code`,
  ADD COLUMN `pool_entered_at` datetime AFTER `pool_status`;
--> statement-breakpoint

CREATE INDEX `idx_crm_customer_status_code` ON `crm_customer` (`status_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_customer_source_code` ON `crm_customer` (`source_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_customer_level_code` ON `crm_customer` (`level_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_customer_industry_code` ON `crm_customer` (`industry_code`);
--> statement-breakpoint
CREATE INDEX `idx_crm_customer_pool_entered_at` ON `crm_customer` (`pool_entered_at`);
