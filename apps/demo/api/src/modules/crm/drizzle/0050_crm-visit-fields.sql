-- Phase 4：crm_activity 加拜访专用字段。
-- 复用 type='visit' 行；planned_at / location / participants / visit_result_code / summary 都可空。
-- 非 visit 类型记录这些字段一律为 NULL。

ALTER TABLE `crm_activity`
  ADD COLUMN `planned_at` datetime AFTER `next_follow_up_at`,
  ADD COLUMN `location` varchar(255) AFTER `planned_at`,
  ADD COLUMN `participants` varchar(500) AFTER `location`,
  ADD COLUMN `visit_result_code` varchar(64) AFTER `participants`,
  ADD COLUMN `summary` varchar(1000) AFTER `visit_result_code`;
--> statement-breakpoint

CREATE INDEX `idx_crm_activity_planned_at` ON `crm_activity` (`planned_at`);
