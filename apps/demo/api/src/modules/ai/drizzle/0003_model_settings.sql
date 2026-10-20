CREATE TABLE `ai_model_settings` (
  `id` int NOT NULL,
  `base_url` varchar(2048) NOT NULL,
  `model` varchar(255) NOT NULL,
  `api_key` varchar(4096) NOT NULL,
  `updated_by` int NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  CONSTRAINT `ai_model_settings_id` PRIMARY KEY (`id`),
  CONSTRAINT `ai_model_settings_singleton` CHECK (`id` = 1)
);
