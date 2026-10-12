CREATE TABLE `sys_user_workbench_pin` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`workbench_menu_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_user_workbench_pin_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_workbench_pin` UNIQUE(`user_id`,`workbench_menu_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_user_workbench_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`workbench_menu_id` int NOT NULL,
	`open_count` int NOT NULL DEFAULT 0,
	`last_opened_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_user_workbench_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_workbench_usage` UNIQUE(`user_id`,`workbench_menu_id`)
);
