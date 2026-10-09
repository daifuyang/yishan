-- 跟进动态：区分类别，并补齐本次沟通结果 / 下次跟进计划。
--
-- category：follow_up / system / business
-- result：本次沟通结果，不覆盖客户状态
-- next_follow_up_plan：下次跟进计划

ALTER TABLE `crm_activity`
  ADD COLUMN `category` VARCHAR(32) NOT NULL DEFAULT 'follow_up',
  ADD COLUMN `result` VARCHAR(64),
  ADD COLUMN `next_follow_up_plan` VARCHAR(500);

UPDATE `crm_activity`
SET `category` = CASE
  WHEN `type` IN ('phone', 'wechat', 'visit', 'meeting', 'email', 'other') THEN 'follow_up'
  WHEN `type` IN ('status_change', 'owner_change', 'qualification', 'profile_edit', 'customer_created') THEN 'system'
  ELSE 'business'
END;

CREATE INDEX `idx_crm_activity_category` ON `crm_activity` (`category`);
