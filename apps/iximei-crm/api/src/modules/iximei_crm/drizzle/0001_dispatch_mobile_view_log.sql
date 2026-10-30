-- 派单客户手机号查看日志
-- 用于记录医院账号查看派单客户手机号明文的行为，super_admin 在派单详情可查看。
-- 物理外键不强制（Drizzle 不在生成列约束时强制外键，与现有 crm_* 表风格一致）。

CREATE TABLE `crm_dispatch_mobile_view_log` (
	`id` INTEGER NOT NULL AUTO_INCREMENT,
	`dispatch_id` INTEGER NOT NULL,
	`viewer_user_id` INTEGER NOT NULL,
	`viewer_username` VARCHAR(100) NOT NULL,
	`viewer_hospital_name` VARCHAR(100),
	`ip_address` VARCHAR(64),
	`created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_dispatch_mobile_view_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_dispatch_mvlog_dispatch` ON `crm_dispatch_mobile_view_log` (`dispatch_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_dispatch_mvlog_user` ON `crm_dispatch_mobile_view_log` (`viewer_user_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_dispatch_mvlog_created` ON `crm_dispatch_mobile_view_log` (`created_at`);
