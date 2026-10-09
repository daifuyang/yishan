ALTER TABLE `crm_customer`
  ADD COLUMN `relationship_status` varchar(16) NOT NULL DEFAULT 'potential' AFTER `status_code`;
--> statement-breakpoint
UPDATE `crm_customer`
SET `relationship_status` = CASE `status_code`
  WHEN 'lost' THEN 'lost'
  WHEN 'following' THEN 'following'
  ELSE 'potential'
END;
--> statement-breakpoint
CREATE INDEX `idx_crm_customer_relationship_status` ON `crm_customer` (`relationship_status`);
--> statement-breakpoint
UPDATE `crm_customer` c
SET `status_code` = CASE
  WHEN c.`relationship_status` = 'lost' THEN 'lost'
  WHEN EXISTS (
    SELECT 1 FROM `crm_contract` ct
    WHERE ct.`customer_id` = c.`id`
      AND ct.`deleted_at` IS NULL
      AND ct.`status` IN ('performing', 'completed')
  ) THEN 'customer'
  WHEN EXISTS (
    SELECT 1 FROM `crm_opportunity` o
    WHERE o.`customer_id` = c.`id`
      AND o.`deleted_at` IS NULL
      AND o.`stage_code` <> 'lost'
  ) THEN 'opportunity'
  ELSE c.`relationship_status`
END;
