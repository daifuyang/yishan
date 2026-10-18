CREATE TABLE `ai_conversations` (
  `id` varchar(64) NOT NULL,
  `owner_id` int NOT NULL,
  `title` varchar(100) NOT NULL,
  `active_owner` int,
  `generation_token` varchar(64),
  `lease_expires_at` datetime(3),
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  CONSTRAINT `ai_conversations_id` PRIMARY KEY (`id`),
  CONSTRAINT `ai_conversations_active_owner` UNIQUE (`active_owner`),
  INDEX `ai_conversations_owner_updated` (`owner_id`, `updated_at`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
  `conversation_id` varchar(64) NOT NULL,
  `id` varchar(64) NOT NULL,
  `position` int NOT NULL,
  `message` json NOT NULL,
  CONSTRAINT `ai_messages_conversation_id` UNIQUE (`conversation_id`, `id`),
  CONSTRAINT `ai_messages_position` UNIQUE (`conversation_id`, `position`),
  CONSTRAINT `ai_messages_conversation_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE
);
