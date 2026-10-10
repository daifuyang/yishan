ALTER TABLE `crm_lead`
  ADD `converted_customer_id` int NULL AFTER `disqualify_code`,
  ADD `converted_contact_id` int NULL AFTER `converted_customer_id`,
  ADD `converted_at` datetime NULL AFTER `converted_contact_id`;
