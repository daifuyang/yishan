ALTER TABLE `crm_quotation`
  ADD COLUMN `public_discount_description` varchar(50) NULL,
  ADD COLUMN `internal_discount_reason` varchar(500) NULL;
