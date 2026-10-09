CREATE TABLE `demo_todos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` varchar(2000) NOT NULL DEFAULT '',
	`status` int NOT NULL DEFAULT 0,
	`due_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `demo_todos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `demo_todos` (`title`, `description`, `status`, `due_at`) VALUES
	('写模块 README', '说明 demo 模块的目录结构与约定。', 1, NULL),
	('跑通健康检查', '通过 /api/demo/v1/info 验证 server-info 服务。', 2, NULL),
	('完成 Todo CRUD', '在 Admin 后台用 ProTable 验证 Todo 增删改查。', 0, NULL);
