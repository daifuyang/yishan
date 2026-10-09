-- 商机阶段拆分：需求确认 / 方案沟通 / 商务报价 / 商务谈判 / 赢单 / 输单
-- 补齐创建商机所需的来源、竞争情况字段。

ALTER TABLE `crm_opportunity`
  ADD COLUMN `source_id` INT NULL,
  ADD COLUMN `competition` VARCHAR(1000) NULL,
  MODIFY COLUMN `stage` VARCHAR(64) NOT NULL DEFAULT 'needs_confirmation';

UPDATE `crm_opportunity` SET `stage` = 'needs_confirmation' WHERE `stage` = 'requirement';
UPDATE `crm_opportunity` SET `stage` = 'quotation' WHERE `stage` = 'proposal';
UPDATE `crm_opportunity_stage_log` SET `from_stage` = 'needs_confirmation' WHERE `from_stage` = 'requirement';
UPDATE `crm_opportunity_stage_log` SET `to_stage` = 'needs_confirmation' WHERE `to_stage` = 'requirement';
UPDATE `crm_opportunity_stage_log` SET `from_stage` = 'quotation' WHERE `from_stage` = 'proposal';
UPDATE `crm_opportunity_stage_log` SET `to_stage` = 'quotation' WHERE `to_stage` = 'proposal';

UPDATE `sys_enum`
SET `code` = 'needs_confirmation', `name` = '需求确认'
WHERE `type` = 'crm_opportunity_stage' AND `code` = 'requirement';
UPDATE `sys_enum`
SET `code` = 'quotation', `name` = '商务报价'
WHERE `type` = 'crm_opportunity_stage' AND `code` = 'proposal';
UPDATE `sys_enum`
SET `name` = '赢单'
WHERE `type` = 'crm_opportunity_stage' AND `code` = 'won';
UPDATE `sys_enum`
SET `name` = '输单'
WHERE `type` = 'crm_opportunity_stage' AND `code` = 'lost';

INSERT INTO `sys_enum` (`type`, `code`, `name`, `sort`, `enabled`, `creator_id`, `updater_id`)
SELECT 'crm_opportunity_stage', 'solution', '方案沟通', 20, 1, 1, 1
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_enum` WHERE `type` = 'crm_opportunity_stage' AND `code` = 'solution'
);
