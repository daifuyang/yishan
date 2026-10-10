-- 合同表：补关联联系人字段。quotationId 已在原 schema 中存在，迁移 SQL 仅补 contact_id。
--
-- contact_id 列：nullable（合同可不绑定具体联系人）；
-- 索引：idx_crm_contract_contact_id 加速按联系人查合同。

ALTER TABLE `crm_contract` ADD COLUMN `contact_id` INT NULL;
CREATE INDEX `idx_crm_contract_contact_id` ON `crm_contract` (`contact_id`);