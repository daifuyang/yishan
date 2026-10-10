CREATE TABLE `sys_enum` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(64) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(64) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`remark` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_enum_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_sys_enum_type_code` UNIQUE(`type`,`code`)
);
--> statement-breakpoint
CREATE INDEX `idx_sys_enum_type_enabled_sort` ON `sys_enum` (`type`,`enabled`,`sort`);--> statement-breakpoint
CREATE INDEX `idx_sys_enum_deleted_at` ON `sys_enum` (`deleted_at`);