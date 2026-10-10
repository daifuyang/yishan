ALTER TABLE `crm_lead`
  ADD `disqualify_code` varchar(32) NULL AFTER `disqualify_reason`;
CREATE INDEX `idx_crm_lead_disqualify_code` ON `crm_lead` (`disqualify_code`);
