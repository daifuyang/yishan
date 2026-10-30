-- 派单「医院查看」留痕日志
-- 医院账号首次打开派单详情时自动写一条；UNIQUE (dispatch_id, hospital_id, viewer_user_id) 兜底幂等。
-- 注：本仓库 crm 模块的 drizzle meta 历史 snapshot 缺失（0000/0001 仅 journal 无 snapshot.json），
-- `drizzle-kit generate` 默认 diff 全量。下方仅保留本次新增的 crm_dispatch_view_log DDL，
-- 其余已有表 0000_init.sql 已负责。snapshot.json 仍按全量基线记录。

CREATE TABLE `crm_dispatch_view_log` (
	`id` INTEGER NOT NULL AUTO_INCREMENT,
	`dispatch_id` INTEGER NOT NULL,
	`hospital_id` INTEGER NOT NULL,
	`viewer_user_id` INTEGER NOT NULL,
	`viewer_username` VARCHAR(100) NOT NULL,
	`viewer_hospital_name` VARCHAR(100),
	`ip_address` VARCHAR(64),
	`created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_dispatch_view_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_dispatch_view_log_dispatch_hospital_user` UNIQUE(`dispatch_id`,`hospital_id`,`viewer_user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_dispatch_view_log_dispatch` ON `crm_dispatch_view_log` (`dispatch_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_dispatch_view_log_hospital` ON `crm_dispatch_view_log` (`hospital_id`);
--> statement-breakpoint
CREATE INDEX `idx_crm_dispatch_view_log_created` ON `crm_dispatch_view_log` (`created_at`);