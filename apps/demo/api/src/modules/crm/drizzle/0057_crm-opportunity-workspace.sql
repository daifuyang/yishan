ALTER TABLE `crm_opportunity`
  ADD `requirement` varchar(2000),
  ADD `scope` varchar(1000),
  ADD `next_action` varchar(500),
  ADD `next_follow_up_at` datetime,
  ADD `remark` varchar(1000);

UPDATE `crm_opportunity`
SET `stage_code` = 'requirement'
WHERE `stage_code` IN ('discover', 'qualify');

UPDATE `crm_opportunity_stage_log`
SET `from_stage` = 'requirement'
WHERE `from_stage` IN ('discover', 'qualify');

UPDATE `crm_opportunity_stage_log`
SET `to_stage` = 'requirement'
WHERE `to_stage` IN ('discover', 'qualify');

ALTER TABLE `crm_opportunity`
  ALTER COLUMN `stage_code` SET DEFAULT 'requirement';
