-- Portal module initial schema.

CREATE TABLE `portal_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100),
	`parent_id` int,
	`status` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`description` varchar(255),
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `portal_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_portal_categories_slug` ON `portal_categories` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_portal_categories_status` ON `portal_categories` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_portal_categories_parent_id` ON `portal_categories` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `idx_portal_categories_deleted_at` ON `portal_categories` (`deleted_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_portal_categories_parent_name` ON `portal_categories` (`parent_id`, `name`);
--> statement-breakpoint

CREATE TABLE `portal_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`slug` varchar(200),
	`summary` varchar(500),
	`content` text NOT NULL,
	`cover_image` varchar(500),
	`status` tinyint NOT NULL DEFAULT 0,
	`is_pinned` boolean NOT NULL DEFAULT false,
	`publish_time` datetime,
	`attributes` json,
	`tags` json,
	`template_id` int,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `portal_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_portal_articles_slug` ON `portal_articles` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_portal_articles_status` ON `portal_articles` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_portal_articles_template_id` ON `portal_articles` (`template_id`);
--> statement-breakpoint
CREATE INDEX `idx_portal_articles_publish_time` ON `portal_articles` (`publish_time`);
--> statement-breakpoint
CREATE INDEX `idx_portal_articles_deleted_at` ON `portal_articles` (`deleted_at`);
--> statement-breakpoint

CREATE TABLE `portal_article_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`article_id` int NOT NULL,
	`category_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `portal_article_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_portal_article_categories_article_id` ON `portal_article_categories` (`article_id`);
--> statement-breakpoint
CREATE INDEX `idx_portal_article_categories_category_id` ON `portal_article_categories` (`category_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_portal_article_categories` ON `portal_article_categories` (`article_id`, `category_id`);
--> statement-breakpoint

CREATE TABLE `portal_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`path` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`attributes` json,
	`publish_time` datetime,
	`template_id` int,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `portal_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_portal_pages_path` ON `portal_pages` (`path`);
--> statement-breakpoint
CREATE INDEX `idx_portal_pages_status` ON `portal_pages` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_portal_pages_template_id` ON `portal_pages` (`template_id`);
--> statement-breakpoint
CREATE INDEX `idx_portal_pages_deleted_at` ON `portal_pages` (`deleted_at`);
--> statement-breakpoint

CREATE TABLE `portal_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`type` tinyint NOT NULL,
	`schema` json,
	`config` json,
	`status` tinyint NOT NULL DEFAULT 1,
	`is_system_default` boolean NOT NULL DEFAULT false,
	`creator_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `portal_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_portal_templates_type` ON `portal_templates` (`type`);
--> statement-breakpoint
CREATE INDEX `idx_portal_templates_status` ON `portal_templates` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_portal_templates_deleted_at` ON `portal_templates` (`deleted_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_portal_templates_type_name` ON `portal_templates` (`type`, `name`);
