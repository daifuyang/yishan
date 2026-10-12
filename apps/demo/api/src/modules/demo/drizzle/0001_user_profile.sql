CREATE TABLE `demo_user_profile` (
  `user_id` int NOT NULL,
  `theme` varchar(20) NOT NULL DEFAULT 'system',
  `last_event` varchar(30) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `demo_user_profile_user_id` PRIMARY KEY (`user_id`)
);
