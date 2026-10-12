CREATE TABLE `shop_attribute_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attribute_id` int NOT NULL,
	`value` varchar(100) NOT NULL,
	`image` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_attribute_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`type` tinyint NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`parent_id` int,
	`cover_image` varchar(500),
	`icon` varchar(100),
	`description` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int NOT NULL,
	`sku_id` int,
	`sku_name` varchar(500),
	`cover_image` varchar(500),
	`product_name` varchar(200) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_no` varchar(32) NOT NULL,
	`user_id` int NOT NULL,
	`total_amount` decimal(10,2) NOT NULL,
	`freight_amount` decimal(10,2) NOT NULL DEFAULT '0',
	`discount_amount` decimal(10,2) NOT NULL DEFAULT '0',
	`pay_amount` decimal(10,2) NOT NULL,
	`pay_status` tinyint NOT NULL DEFAULT 0,
	`pay_time` datetime,
	`pay_method` varchar(20),
	`pay_transaction_id` varchar(64),
	`order_status` tinyint NOT NULL DEFAULT 1,
	`express_company` varchar(50),
	`express_no` varchar(50),
	`deliver_time` datetime,
	`receive_time` datetime,
	`cancel_reason` varchar(255),
	`remark` varchar(500),
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_shop_orders_order_no` UNIQUE(`order_no`)
);
--> statement-breakpoint
CREATE TABLE `shop_product_skus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`sku_code` varchar(64) NOT NULL,
	`sku_name` varchar(500) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`cost_price` decimal(10,2),
	`stock` int NOT NULL DEFAULT 0,
	`weight` decimal(10,2),
	`cover_image` varchar(500),
	`status` tinyint NOT NULL DEFAULT 1,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_product_skus_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_shop_product_skus_sku_code` UNIQUE(`sku_code`)
);
--> statement-breakpoint
CREATE TABLE `shop_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`subtitle` varchar(500),
	`cover_image` varchar(500),
	`images` json,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`cost_price` decimal(10,2),
	`stock` int NOT NULL DEFAULT 0,
	`unit` varchar(20) NOT NULL DEFAULT '件',
	`weight` decimal(10,2),
	`status` tinyint NOT NULL DEFAULT 1,
	`is_hot` boolean NOT NULL DEFAULT false,
	`is_new` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`click_count` int NOT NULL DEFAULT 0,
	`creator_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updater_id` int NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`deleted_at` datetime,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shop_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_sku_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku_id` int NOT NULL,
	`attribute_id` int NOT NULL,
	`value_id` int NOT NULL,
	CONSTRAINT `shop_sku_attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_shop_sku_attributes` UNIQUE(`sku_id`,`attribute_id`,`value_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_shop_attribute_values_attr_id` ON `shop_attribute_values` (`attribute_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_attribute_values_status` ON `shop_attribute_values` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_attribute_values_deleted_at` ON `shop_attribute_values` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_attributes_status` ON `shop_attributes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_attributes_type` ON `shop_attributes` (`type`);--> statement-breakpoint
CREATE INDEX `idx_shop_attributes_deleted_at` ON `shop_attributes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_categories_status` ON `shop_categories` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_categories_parent_id` ON `shop_categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_categories_sort_order` ON `shop_categories` (`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_shop_categories_deleted_at` ON `shop_categories` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_order_items_order` ON `shop_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_order_items_product` ON `shop_order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_order_items_sku` ON `shop_order_items` (`sku_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_order_items_deleted_at` ON `shop_order_items` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_orders_user` ON `shop_orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_orders_status` ON `shop_orders` (`order_status`);--> statement-breakpoint
CREATE INDEX `idx_shop_orders_pay_status` ON `shop_orders` (`pay_status`);--> statement-breakpoint
CREATE INDEX `idx_shop_orders_created` ON `shop_orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_orders_deleted_at` ON `shop_orders` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_orders_express` ON `shop_orders` (`express_no`);--> statement-breakpoint
CREATE INDEX `idx_shop_product_skus_product` ON `shop_product_skus` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_product_skus_status` ON `shop_product_skus` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_product_skus_deleted_at` ON `shop_product_skus` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_category` ON `shop_products` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_status` ON `shop_products` (`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_hot` ON `shop_products` (`is_hot`,`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_new` ON `shop_products` (`is_new`,`status`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_price` ON `shop_products` (`price`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_created` ON `shop_products` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_products_deleted_at` ON `shop_products` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_shop_sku_attributes_sku` ON `shop_sku_attributes` (`sku_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_sku_attributes_attr` ON `shop_sku_attributes` (`attribute_id`);--> statement-breakpoint
CREATE INDEX `idx_shop_sku_attributes_value` ON `shop_sku_attributes` (`value_id`);