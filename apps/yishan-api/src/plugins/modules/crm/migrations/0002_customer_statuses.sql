-- Align the CRM customer status vocabulary with the legacy customer form.
INSERT INTO `iximei_crm_customer_status` (`id`, `name`, `sort_order`, `status`)
VALUES
  (1, '资料录入', 1, 1),
  (2, '待跟进', 2, 1),
  (3, '重单', 3, 1),
  (4, '已手术', 4, 1),
  (5, '无效用户', 5, 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `sort_order` = VALUES(`sort_order`),
  `status` = VALUES(`status`),
  `updated_at` = CURRENT_TIMESTAMP(0);
