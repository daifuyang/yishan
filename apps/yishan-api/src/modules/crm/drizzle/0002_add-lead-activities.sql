CREATE TABLE `crm_lead_activity` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lead_id` int NOT NULL,
  `type` varchar(16) NOT NULL,
  `content` varchar(2000) NOT NULL DEFAULT '',
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `next_follow_up_at` datetime,
  `operator_user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  CONSTRAINT `crm_lead_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_lead_activity_lead_id` ON `crm_lead_activity` (`lead_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_lead_activity_operator_user_id` ON `crm_lead_activity` (`operator_user_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_lead_activity_lead_occurred` ON `crm_lead_activity` (`lead_id`,`occurred_at`);
