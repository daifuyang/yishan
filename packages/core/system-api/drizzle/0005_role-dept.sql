CREATE TABLE `sys_role_dept` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`dept_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_role_dept_id` PRIMARY KEY(`id`),
	INDEX `idx_role_dept_role_id` (`role_id`),
	INDEX `idx_role_dept_dept_id` (`dept_id`),
	CONSTRAINT `uniq_role_dept` UNIQUE(`role_id`,`dept_id`)
);
