ALTER TABLE crm_lead
  MODIFY COLUMN status varchar(16) NOT NULL DEFAULT 'pending';

UPDATE crm_lead SET status = 'pending' WHERE status IN ('new', 'processing', 'converted');
UPDATE crm_lead SET status = 'contact_valid' WHERE status = 'qualified';
UPDATE crm_lead SET status = 'contact_invalid' WHERE status = 'disqualified';
