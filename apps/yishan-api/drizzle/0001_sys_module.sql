CREATE TABLE `sys_module` (
	`id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`table_prefix` varchar(32) NOT NULL,
	`version` varchar(32) NOT NULL DEFAULT '0.0.0',
	`enabled` tinyint NOT NULL DEFAULT 1,
	`installed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sys_module_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_sys_module_enabled` ON `sys_module` (`enabled`);--> statement-breakpoint
CREATE TABLE `sys_module_migration` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`module_id` varchar(64) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_module_migration_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_sys_module_migration_module_hash` ON `sys_module_migration` (`module_id`,`hash`);--> statement-breakpoint
CREATE INDEX `idx_sys_module_migration_module_id` ON `sys_module_migration` (`module_id`);
