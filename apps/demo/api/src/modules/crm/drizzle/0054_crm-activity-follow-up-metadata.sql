-- Store attachments and extensible metadata on CRM follow-up activities.
ALTER TABLE `crm_activity`
  ADD `attachment_ids` json,
  ADD `metadata` json;
