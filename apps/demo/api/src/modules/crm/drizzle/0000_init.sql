CREATE TABLE `crm_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`contact_id` int,
	`type` varchar(16) NOT NULL,
	`content` varchar(2000) NOT NULL DEFAULT '',
	`occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`next_follow_up_at` datetime,
	`operator_user_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_contact` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`gender` tinyint NOT NULL DEFAULT 0,
	`mobile` varchar(32),
	`phone` varchar(32),
	`email` varchar(100),
	`department` varchar(100),
	`position` varchar(100),
	`is_primary` tinyint NOT NULL DEFAULT 0,
	`birthday` datetime,
	`remark` varchar(1000),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_contact_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_customer` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32),
	`name` varchar(200) NOT NULL,
	`type` varchar(16) NOT NULL DEFAULT 'enterprise',
	`status_id` int,
	`source_id` int,
	`level` varchar(16),
	`industry` varchar(64),
	`phone` varchar(32),
	`website` varchar(200),
	`province` varchar(64),
	`city` varchar(64),
	`address` varchar(255),
	`owner_user_id` int,
	`owner_department_id` int,
	`pool_status` varchar(16) NOT NULL DEFAULT 'public',
	`last_follow_up_at` datetime,
	`next_follow_up_at` datetime,
	`remark` varchar(2000),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_customer_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_customer_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `crm_customer_source` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`code` varchar(50),
	`sort` int NOT NULL DEFAULT 0,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_customer_source_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_customer_source_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `crm_customer_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`code` varchar(50),
	`type` varchar(16) NOT NULL DEFAULT 'active',
	`sort` int NOT NULL DEFAULT 0,
	`enabled` tinyint NOT NULL DEFAULT 1,
	`is_system` tinyint NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_customer_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_customer_status_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `crm_customer_tag` (
	`customer_id` int NOT NULL,
	`tag_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `uniq_crm_customer_tag` UNIQUE(`customer_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `crm_customer_transfer` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`type` varchar(16) NOT NULL,
	`from_user_id` int,
	`to_user_id` int,
	`operator_user_id` int NOT NULL,
	`reason` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `crm_customer_transfer_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_tag` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`color` varchar(16),
	`enabled` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	CONSTRAINT `crm_tag_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_crm_tag_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_activity_customer_id` ON `crm_activity` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_operator_user_id` ON `crm_activity` (`operator_user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_occurred_at` ON `crm_activity` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_activity_customer_occurred` ON `crm_activity` (`customer_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_contact_customer_id` ON `crm_contact` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_contact_mobile` ON `crm_contact` (`mobile`);--> statement-breakpoint
CREATE INDEX `idx_crm_contact_deleted_at` ON `crm_contact` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_name` ON `crm_customer` (`name`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_phone` ON `crm_customer` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_owner_user_id` ON `crm_customer` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_owner_department_id` ON `crm_customer` (`owner_department_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_pool_status` ON `crm_customer` (`pool_status`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_status_id` ON `crm_customer` (`status_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_source_id` ON `crm_customer` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_last_follow_up_at` ON `crm_customer` (`last_follow_up_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_next_follow_up_at` ON `crm_customer` (`next_follow_up_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_deleted_at` ON `crm_customer` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_owner_dept_status` ON `crm_customer` (`owner_department_id`,`pool_status`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_source_deleted_at` ON `crm_customer_source` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_status_deleted_at` ON `crm_customer_status` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_tag_tag_id` ON `crm_customer_tag` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_transfer_customer_id` ON `crm_customer_transfer` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_customer_transfer_created_at` ON `crm_customer_transfer` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crm_tag_deleted_at` ON `crm_tag` (`deleted_at`);--> statement-breakpoint
INSERT INTO `crm_customer_status` (`name`, `code`, `type`, `sort`, `enabled`, `is_system`)
VALUES
	('待跟进', 'pending', 'active', 1, 1, 1),
	('初步沟通', 'contacted', 'active', 2, 1, 1),
	('需求确认', 'qualified', 'active', 3, 1, 1),
	('方案报价', 'proposal', 'active', 4, 1, 1),
	('已成交', 'won', 'won', 5, 1, 1),
	('已流失', 'lost', 'lost', 6, 1, 1);--> statement-breakpoint
INSERT INTO `crm_customer_source` (`name`, `code`, `sort`, `enabled`)
VALUES
	('主动开发', 'outbound', 1, 1),
	('客户转介绍', 'referral', 2, 1),
	('官网', 'website', 3, 1),
	('电话咨询', 'phone_inquiry', 4, 1),
	('线下活动', 'offline_event', 5, 1),
	('抖音', 'douyin', 6, 1),
	('小红书', 'xiaohongshu', 7, 1),
	('微信', 'wechat', 8, 1),
	('其他', 'other', 99, 1);