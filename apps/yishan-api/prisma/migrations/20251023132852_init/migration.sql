/*
  Warnings:

  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `user`;

-- CreateTable
CREATE TABLE `sys_user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `salt` VARCHAR(32) NOT NULL,
    `real_name` VARCHAR(50) NOT NULL,
    `avatar` VARCHAR(500) NULL,
    `gender` TINYINT NOT NULL DEFAULT 0,
    `birth_date` DATE NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `last_login_time` DATETIME(0) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `login_count` INTEGER NOT NULL DEFAULT 0,
    `creator_id` BIGINT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` BIGINT NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_user_username_key`(`username`),
    UNIQUE INDEX `sys_user_email_key`(`email`),
    UNIQUE INDEX `sys_user_phone_key`(`phone`),
    INDEX `idx_status`(`status`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_deleted_at`(`deleted_at`),
    INDEX `idx_creator_id`(`creator_id`),
    INDEX `idx_updater_id`(`updater_id`),
    INDEX `idx_status_created`(`status`, `created_at`),
    INDEX `idx_real_name_status`(`real_name`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sys_user` ADD CONSTRAINT `sys_user_creator_id_fkey` FOREIGN KEY (`creator_id`) REFERENCES `sys_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sys_user` ADD CONSTRAINT `sys_user_updater_id_fkey` FOREIGN KEY (`updater_id`) REFERENCES `sys_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
