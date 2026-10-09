-- 报价单：补全「名称」与「整单优惠」两个字段；放开 item.productId 以支持自定义项。
--
-- Phase X 报价单重构引入：
--   - crm_quotation.name             ：业务可见的报价单名称（前端必填）
--   - crm_quotation.discount_amount_cents ：整单优惠（cents BIGINT），与每行 discountBp 叠加
--   - crm_quotation_item.product_id  ：改为可空，允许「自定义项」不绑定 Product 主数据
--
-- 历史数据兼容：
--   - 现有报价单的 name 默认空字符串（前端/详情页会兜底展示 quotationNo）
--   - 现有报价单的 discount_amount_cents 默认 0，与既有语义一致
--   - 现有 item 行 product_id 已有值，无需处理

ALTER TABLE `crm_quotation` ADD COLUMN `name` varchar(200) NOT NULL DEFAULT '';
ALTER TABLE `crm_quotation` ADD COLUMN `discount_amount_cents` BIGINT NOT NULL DEFAULT 0;
ALTER TABLE `crm_quotation_item` MODIFY COLUMN `product_id` INT NULL;