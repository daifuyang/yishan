-- 回款表：补 payment_no / transaction_no / status 三列。
--
-- payment_no：业务可见回款单号，全局唯一（uniq index），服务层按 RC-yyyyMMdd-NNNN
-- 规则生成（payment.service.createWithUniquePaymentNo）。
-- transaction_no：银行 / 支付宝 / 微信 交易流水号；可空。
-- status：回款生命周期状态；MVP 仅 default 'confirmed'，UI 不暴露，预留 PENDING/VOIDED 扩展位。
--
-- 历史数据回填：旧行 payment_no=''，先 UPDATE 一遍再 ADD UNIQUE INDEX，
-- 否则旧行会被 uniq 校验直接撞键。

UPDATE `crm_payment` SET `payment_no` = CONCAT('RC-LEGACY-', `id`) WHERE `payment_no` = '';

ALTER TABLE `crm_payment`
  ADD COLUMN `payment_no` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `transaction_no` VARCHAR(64) NULL,
  ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'confirmed';

CREATE UNIQUE INDEX `uniq_crm_payment_no` ON `crm_payment` (`payment_no`);
CREATE INDEX `idx_crm_payment_status` ON `crm_payment` (`status`);