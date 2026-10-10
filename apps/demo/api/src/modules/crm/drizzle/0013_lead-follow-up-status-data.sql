UPDATE `crm_lead`
SET `status` = 'pending'
WHERE `status` IN ('new', 'processing', 'converted');--> statement-breakpoint
UPDATE `crm_lead`
SET `status` = 'contact_valid'
WHERE `status` = 'qualified';--> statement-breakpoint
UPDATE `crm_lead`
SET `status` = 'contact_invalid'
WHERE `status` = 'disqualified';
