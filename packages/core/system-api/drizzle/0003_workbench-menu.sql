CREATE TABLE `sys_workbench_menu` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parent_id` int,
	`type` tinyint NOT NULL DEFAULT 1,
	`name` varchar(100) NOT NULL,
	`icon` varchar(100),
	`page` varchar(255),
	`module_id` varchar(64) NOT NULL DEFAULT 'core',
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_workbench_menu_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_role_workbench_menu` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`workbench_menu_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_role_workbench_menu_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_role_workbench_menu` UNIQUE(`role_id`,`workbench_menu_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_workbench_menu_parent_id` ON `sys_workbench_menu` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_workbench_menu_page` ON `sys_workbench_menu` (`page`);--> statement-breakpoint
CREATE INDEX `idx_workbench_menu_module_id` ON `sys_workbench_menu` (`module_id`);--> statement-breakpoint
CREATE INDEX `idx_workbench_menu_deleted_at` ON `sys_workbench_menu` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_workbench_menu_sort_order` ON `sys_workbench_menu` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_role_workbench_menu_role_id` ON `sys_role_workbench_menu` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_role_workbench_menu_menu_id` ON `sys_role_workbench_menu` (`workbench_menu_id`);
