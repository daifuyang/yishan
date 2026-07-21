CREATE TABLE `sys_api_token` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`scopes` json,
	`token_hash` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime,
	`last_used_at` datetime,
	`last_used_ip` varchar(45),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_api_token_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_api_token_token_hash_key` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `sys_app` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(100),
	`icon_color` varchar(50),
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`description` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_app_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_app_name_key` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sys_app_menu` (
	`id` int AUTO_INCREMENT NOT NULL,
	`app_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`path` varchar(255),
	`icon` varchar(100),
	`component` varchar(255),
	`type` tinyint NOT NULL DEFAULT 1,
	`parent_id` int,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`hide_in_menu` boolean NOT NULL DEFAULT false,
	`is_external_link` boolean NOT NULL DEFAULT false,
	`keep_alive` boolean NOT NULL DEFAULT false,
	`resource_id` int,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_app_menu_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_app_menu_app_parent_name` UNIQUE(`app_id`,`parent_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `sys_app_resource` (
	`id` int AUTO_INCREMENT NOT NULL,
	`app_id` int NOT NULL,
	`parent_id` int,
	`type` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`config` json,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_app_resource_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_attachment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folder_id` int,
	`kind` tinyint NOT NULL DEFAULT 4,
	`name` varchar(255),
	`original_name` varchar(255) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`ext` varchar(20),
	`mime_type` varchar(100) NOT NULL,
	`size` int NOT NULL DEFAULT 0,
	`storage` varchar(20) NOT NULL DEFAULT 'local',
	`path` varchar(500),
	`url` varchar(500),
	`object_key` varchar(500),
	`hash` varchar(64),
	`width` int,
	`height` int,
	`duration` int,
	`metadata` json,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_attachment_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_attachment_hash_storage` UNIQUE(`hash`,`storage`)
);
--> statement-breakpoint
CREATE TABLE `sys_attachment_folder` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`parent_id` int,
	`kind` tinyint NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`remark` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_attachment_folder_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_attachment_folder_parent_name` UNIQUE(`parent_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `sys_dept` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`parent_id` int,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`description` varchar(255),
	`leader_id` int,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_dept_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_dept_name_key` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sys_dict_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type_id` int NOT NULL,
	`label` varchar(100) NOT NULL,
	`value` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`tag` varchar(50),
	`remark` varchar(255),
	`is_default` boolean NOT NULL DEFAULT false,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_dict_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_dict_data_value` UNIQUE(`type_id`,`value`)
);
--> statement-breakpoint
CREATE TABLE `sys_dict_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`remark` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_dict_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_dict_type_type_key` UNIQUE(`type`)
);
--> statement-breakpoint
CREATE TABLE `sys_form_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resource_id` int NOT NULL,
	`data` json NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_form_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_form_field` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resource_id` int NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(100),
	`type` varchar(50) NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`config` json,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_form_field_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_form_field_resource_key` UNIQUE(`resource_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `sys_login_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`username` varchar(100) NOT NULL,
	`real_name` varchar(50),
	`status` tinyint NOT NULL DEFAULT 1,
	`message` varchar(255),
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_login_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_menu` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`path` varchar(255),
	`icon` varchar(100),
	`component` varchar(255),
	`type` tinyint NOT NULL DEFAULT 1,
	`parent_id` int,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`hide_in_menu` boolean NOT NULL DEFAULT false,
	`is_default_action` boolean NOT NULL DEFAULT false,
	`is_external_link` boolean NOT NULL DEFAULT false,
	`keep_alive` boolean NOT NULL DEFAULT false,
	`source` varchar(20) NOT NULL DEFAULT 'custom',
	`plugin_name` varchar(100),
	`plugin_menu_key` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_menu_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_menu_path_key` UNIQUE(`path`),
	CONSTRAINT `uniq_menu_parent_name` UNIQUE(`parent_id`,`name`),
	CONSTRAINT `uniq_plugin_menu_key` UNIQUE(`plugin_menu_key`)
);
--> statement-breakpoint
CREATE TABLE `sys_menu_permission` (
	`id` int AUTO_INCREMENT NOT NULL,
	`menu_id` int NOT NULL,
	`permission_code` varchar(128) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_menu_permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_menu_permission` UNIQUE(`menu_id`,`permission_code`)
);
--> statement-breakpoint
CREATE TABLE `sys_option` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`description` varchar(255),
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_option_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_option_key_key` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `sys_plugin` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plugin_id` varchar(100),
	`org` varchar(50),
	`slug` varchar(50),
	`source` varchar(30),
	`name` varchar(100),
	`current_version` varchar(50) NOT NULL,
	`core_compatibility` varchar(50),
	`compat_range` varchar(100),
	`route_base` varchar(255),
	`lifecycle_state` varchar(30) NOT NULL DEFAULT 'discovered',
	`enabled` boolean NOT NULL DEFAULT false,
	`installed_at` datetime,
	`last_synced_at` datetime,
	`last_error` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_plugin_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_plugin_plugin_id_key` UNIQUE(`plugin_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_plugin_config_snapshot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plugin_id` int NOT NULL,
	`version` varchar(50) NOT NULL,
	`config` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_plugin_config_snapshot_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_plugin_install` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plugin_id` int NOT NULL,
	`lifecycle_state` varchar(30) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`installed_at` datetime,
	`uninstalled_at` datetime,
	`last_error` varchar(500),
	`sync_strategy` varchar(20) DEFAULT 'safe',
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_plugin_install_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_plugin_install_plugin_id_key` UNIQUE(`plugin_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_plugin_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plugin_install_id` int NOT NULL,
	`strategy` varchar(20) NOT NULL DEFAULT 'safe',
	`status` varchar(20) NOT NULL DEFAULT 'success',
	`created` int NOT NULL DEFAULT 0,
	`updated` int NOT NULL DEFAULT 0,
	`skipped` int NOT NULL DEFAULT 0,
	`conflicted` int NOT NULL DEFAULT 0,
	`conflict_details` json,
	`error_message` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_plugin_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_plugin_version` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plugin_id` int NOT NULL,
	`version` varchar(50) NOT NULL,
	`manifest` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_plugin_version_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_sys_plugin_version` UNIQUE(`plugin_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `sys_post` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`description` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_post_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_post_name_key` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sys_region` (
	`code` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`level` tinyint NOT NULL,
	`parent_code` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_region_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `sys_role` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`code` varchar(50),
	`description` varchar(255),
	`status` tinyint NOT NULL DEFAULT 1,
	`data_scope` tinyint NOT NULL DEFAULT 1,
	`is_system_default` boolean NOT NULL DEFAULT false,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_role_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_role_name_key` UNIQUE(`name`),
	CONSTRAINT `uniq_role_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sys_role_menu` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`menu_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_role_menu_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_role_menu` UNIQUE(`role_id`,`menu_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_role_permission` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`permission_code` varchar(128) NOT NULL,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_role_permission_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_role_permission` UNIQUE(`role_id`,`permission_code`)
);
--> statement-breakpoint
CREATE TABLE `sys_user` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50),
	`email` varchar(100),
	`phone` varchar(20) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`real_name` varchar(50),
	`nickname` varchar(50),
	`avatar` varchar(500),
	`gender` tinyint NOT NULL DEFAULT 0,
	`birth_date` date,
	`status` tinyint NOT NULL DEFAULT 1,
	`last_login_time` datetime,
	`last_login_ip` varchar(45),
	`login_count` int NOT NULL DEFAULT 0,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sys_user_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_user_username_key` UNIQUE(`username`),
	CONSTRAINT `sys_user_email_key` UNIQUE(`email`),
	CONSTRAINT `sys_user_phone_key` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `sys_user_dept` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`dept_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_user_dept_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_dept` UNIQUE(`user_id`,`dept_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_user_role` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`role_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_user_role_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_role` UNIQUE(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_user_token` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`access_token` varchar(512) NOT NULL,
	`refresh_token` varchar(512) NOT NULL,
	`access_token_expires_at` datetime NOT NULL,
	`refresh_token_expires_at` datetime NOT NULL,
	`is_revoked` boolean NOT NULL DEFAULT false,
	`revoked_at` datetime,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `sys_user_token_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_api_token_user_id` ON `sys_api_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_api_token_deleted_at` ON `sys_api_token` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_api_token_expires_at` ON `sys_api_token` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_app_status` ON `sys_app` (`status`);--> statement-breakpoint
CREATE INDEX `idx_app_created_at` ON `sys_app` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_app_deleted_at` ON `sys_app` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_app_sort_order` ON `sys_app` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_app_creator_id_idx` ON `sys_app` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_app_updater_id_idx` ON `sys_app` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_app_id` ON `sys_app_menu` (`app_id`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_resource_id` ON `sys_app_menu` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_status` ON `sys_app_menu` (`status`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_created_at` ON `sys_app_menu` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_deleted_at` ON `sys_app_menu` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_parent_id` ON `sys_app_menu` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_app_menu_sort_order` ON `sys_app_menu` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_app_menu_updater_id_idx` ON `sys_app_menu` (`updater_id`);--> statement-breakpoint
CREATE INDEX `sys_app_menu_creator_id_idx` ON `sys_app_menu` (`creator_id`);--> statement-breakpoint
CREATE INDEX `idx_app_resource_app_id` ON `sys_app_resource` (`app_id`);--> statement-breakpoint
CREATE INDEX `idx_app_resource_parent_id` ON `sys_app_resource` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_app_resource_type` ON `sys_app_resource` (`type`);--> statement-breakpoint
CREATE INDEX `idx_app_resource_status` ON `sys_app_resource` (`status`);--> statement-breakpoint
CREATE INDEX `idx_app_resource_deleted_at` ON `sys_app_resource` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_app_resource_sort_order` ON `sys_app_resource` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_app_resource_creator_id_idx` ON `sys_app_resource` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_app_resource_updater_id_idx` ON `sys_app_resource` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_id` ON `sys_attachment` (`folder_id`);--> statement-breakpoint
CREATE INDEX `idx_attachment_kind` ON `sys_attachment` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_attachment_mime_type` ON `sys_attachment` (`mime_type`);--> statement-breakpoint
CREATE INDEX `idx_attachment_storage` ON `sys_attachment` (`storage`);--> statement-breakpoint
CREATE INDEX `idx_attachment_status` ON `sys_attachment` (`status`);--> statement-breakpoint
CREATE INDEX `idx_attachment_created_at` ON `sys_attachment` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_attachment_deleted_at` ON `sys_attachment` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `sys_attachment_creator_id_idx` ON `sys_attachment` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_attachment_updater_id_idx` ON `sys_attachment` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_kind` ON `sys_attachment_folder` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_status` ON `sys_attachment_folder` (`status`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_created_at` ON `sys_attachment_folder` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_deleted_at` ON `sys_attachment_folder` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_parent_id` ON `sys_attachment_folder` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_attachment_folder_sort_order` ON `sys_attachment_folder` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_attachment_folder_creator_id_idx` ON `sys_attachment_folder` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_attachment_folder_updater_id_idx` ON `sys_attachment_folder` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_dept_status` ON `sys_dept` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dept_created_at` ON `sys_dept` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dept_deleted_at` ON `sys_dept` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_dept_parent_id` ON `sys_dept` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_dept_sort_order` ON `sys_dept` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_dept_leader_id_idx` ON `sys_dept` (`leader_id`);--> statement-breakpoint
CREATE INDEX `sys_dept_creator_id_idx` ON `sys_dept` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_dept_updater_id_idx` ON `sys_dept` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_dict_data_type_id` ON `sys_dict_data` (`type_id`);--> statement-breakpoint
CREATE INDEX `idx_dict_data_status` ON `sys_dict_data` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dict_data_created_at` ON `sys_dict_data` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dict_data_deleted_at` ON `sys_dict_data` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_dict_data_sort_order` ON `sys_dict_data` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_dict_data_creator_id_idx` ON `sys_dict_data` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_dict_data_updater_id_idx` ON `sys_dict_data` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_dict_type_status` ON `sys_dict_type` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dict_type_created_at` ON `sys_dict_type` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_dict_type_deleted_at` ON `sys_dict_type` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_dict_type_sort_order` ON `sys_dict_type` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_dict_type_creator_id_idx` ON `sys_dict_type` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_dict_type_updater_id_idx` ON `sys_dict_type` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_form_data_resource_id` ON `sys_form_data` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_form_data_status` ON `sys_form_data` (`status`);--> statement-breakpoint
CREATE INDEX `idx_form_data_created_at` ON `sys_form_data` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_form_data_deleted_at` ON `sys_form_data` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `sys_form_data_creator_id_idx` ON `sys_form_data` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_form_data_updater_id_idx` ON `sys_form_data` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_form_field_resource_id` ON `sys_form_field` (`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_form_field_status` ON `sys_form_field` (`status`);--> statement-breakpoint
CREATE INDEX `idx_form_field_deleted_at` ON `sys_form_field` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_form_field_sort_order` ON `sys_form_field` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_form_field_creator_id_idx` ON `sys_form_field` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_form_field_updater_id_idx` ON `sys_form_field` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_login_log_user_id` ON `sys_login_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_login_log_username` ON `sys_login_log` (`username`);--> statement-breakpoint
CREATE INDEX `idx_login_log_status` ON `sys_login_log` (`status`);--> statement-breakpoint
CREATE INDEX `idx_login_log_created_at` ON `sys_login_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_login_log_ip_address` ON `sys_login_log` (`ip_address`);--> statement-breakpoint
CREATE INDEX `idx_login_log_deleted_at` ON `sys_login_log` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_login_log_status_created_at` ON `sys_login_log` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_menu_status` ON `sys_menu` (`status`);--> statement-breakpoint
CREATE INDEX `idx_menu_created_at` ON `sys_menu` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_menu_deleted_at` ON `sys_menu` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_menu_parent_id` ON `sys_menu` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_menu_sort_order` ON `sys_menu` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_menu_updater_id_idx` ON `sys_menu` (`updater_id`);--> statement-breakpoint
CREATE INDEX `sys_menu_creator_id_idx` ON `sys_menu` (`creator_id`);--> statement-breakpoint
CREATE INDEX `idx_menu_plugin_name` ON `sys_menu` (`plugin_name`);--> statement-breakpoint
CREATE INDEX `idx_menu_source` ON `sys_menu` (`source`);--> statement-breakpoint
CREATE INDEX `idx_menu_permission_menu_id` ON `sys_menu_permission` (`menu_id`);--> statement-breakpoint
CREATE INDEX `idx_menu_permission_code` ON `sys_menu_permission` (`permission_code`);--> statement-breakpoint
CREATE INDEX `idx_option_key` ON `sys_option` (`key`);--> statement-breakpoint
CREATE INDEX `idx_option_status` ON `sys_option` (`status`);--> statement-breakpoint
CREATE INDEX `idx_option_deleted_at` ON `sys_option` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_enabled` ON `sys_plugin` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_lifecycle_state` ON `sys_plugin` (`lifecycle_state`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_updated_at` ON `sys_plugin` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_plugin_id` ON `sys_plugin` (`plugin_id`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_config_snapshot_plugin_id` ON `sys_plugin_config_snapshot` (`plugin_id`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_install_plugin_id` ON `sys_plugin_install` (`plugin_id`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_install_enabled` ON `sys_plugin_install` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_sync_log_plugin_install_id` ON `sys_plugin_sync_log` (`plugin_install_id`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_sync_log_created_at` ON `sys_plugin_sync_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sys_plugin_version_plugin_id` ON `sys_plugin_version` (`plugin_id`);--> statement-breakpoint
CREATE INDEX `idx_post_status` ON `sys_post` (`status`);--> statement-breakpoint
CREATE INDEX `idx_post_created_at` ON `sys_post` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_post_deleted_at` ON `sys_post` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_post_sort_order` ON `sys_post` (`sort_order`);--> statement-breakpoint
CREATE INDEX `sys_post_creator_id_idx` ON `sys_post` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_post_updater_id_idx` ON `sys_post` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_sys_region_parent` ON `sys_region` (`parent_code`);--> statement-breakpoint
CREATE INDEX `idx_sys_region_level` ON `sys_region` (`level`);--> statement-breakpoint
CREATE INDEX `idx_sys_region_status` ON `sys_region` (`status`);--> statement-breakpoint
CREATE INDEX `idx_role_status` ON `sys_role` (`status`);--> statement-breakpoint
CREATE INDEX `idx_role_created_at` ON `sys_role` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_role_deleted_at` ON `sys_role` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `sys_role_creator_id_idx` ON `sys_role` (`creator_id`);--> statement-breakpoint
CREATE INDEX `sys_role_updater_id_idx` ON `sys_role` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_role_menu_role_id` ON `sys_role_menu` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_role_menu_menu_id` ON `sys_role_menu` (`menu_id`);--> statement-breakpoint
CREATE INDEX `idx_role_permission_role_id` ON `sys_role_permission` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_role_permission_code` ON `sys_role_permission` (`permission_code`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `sys_user` (`status`);--> statement-breakpoint
CREATE INDEX `idx_created_at` ON `sys_user` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_deleted_at` ON `sys_user` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_creator_id` ON `sys_user` (`creator_id`);--> statement-breakpoint
CREATE INDEX `idx_updater_id` ON `sys_user` (`updater_id`);--> statement-breakpoint
CREATE INDEX `idx_status_created` ON `sys_user` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_real_name_status` ON `sys_user` (`real_name`,`status`);--> statement-breakpoint
CREATE INDEX `idx_user_dept_user_id` ON `sys_user_dept` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_dept_dept_id` ON `sys_user_dept` (`dept_id`);--> statement-breakpoint
CREATE INDEX `idx_user_role_user_id` ON `sys_user_role` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_role_role_id` ON `sys_user_role` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_user_token_user_id` ON `sys_user_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_is_revoked` ON `sys_user_token` (`is_revoked`);--> statement-breakpoint
CREATE INDEX `idx_access_token_expires` ON `sys_user_token` (`access_token_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_refresh_token_expires` ON `sys_user_token` (`refresh_token_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_user_revoked` ON `sys_user_token` (`user_id`,`is_revoked`);