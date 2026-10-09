-- 初始化历史编号计数，避免事务回滚后反复分配已占用的商机编号。
-- 保留更高的现有计数；包含软删除数据，已使用的编号不再分配。
INSERT INTO `crm_business_number` (`prefix`, `next_value`)
SELECT CONCAT(SUBSTRING_INDEX(`opportunity_no`, '-', 2), '-'),
       MAX(CAST(SUBSTRING_INDEX(`opportunity_no`, '-', -1) AS UNSIGNED)) + 1
FROM `crm_opportunity`
WHERE `opportunity_no` REGEXP '^OPP-[0-9]{6}-[0-9]+$'
GROUP BY CONCAT(SUBSTRING_INDEX(`opportunity_no`, '-', 2), '-')
ON DUPLICATE KEY UPDATE `next_value` = GREATEST(`next_value`, VALUES(`next_value`));
--> statement-breakpoint
INSERT INTO `crm_business_number` (`prefix`, `next_value`)
SELECT CONCAT(SUBSTRING_INDEX(`series_no`, '-', 2), '-'),
       MAX(CAST(SUBSTRING_INDEX(`series_no`, '-', -1) AS UNSIGNED)) + 1
FROM `crm_quotation`
WHERE `series_no` REGEXP '^Q-[0-9]{8}-[0-9]+$'
GROUP BY CONCAT(SUBSTRING_INDEX(`series_no`, '-', 2), '-')
ON DUPLICATE KEY UPDATE `next_value` = GREATEST(`next_value`, VALUES(`next_value`));
