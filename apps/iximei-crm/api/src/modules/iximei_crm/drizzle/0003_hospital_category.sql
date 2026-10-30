-- 医院分类：'oral' 口腔 / 'plastic' 整形 / NULL 视为 dashboard 派生 'unknown'。
-- VARCHAR(20) 容纳两个枚举值；可空，兼容历史行（NULL = 未分类）。
-- 不加索引：dashboard 按 category 聚合走全表 hash aggregate，已是 O(n)；引入索引
-- 反而增加写入开销。分类基数小（2），索引区分度低。
ALTER TABLE `crm_hospital` ADD COLUMN `category` VARCHAR(20);