-- Base framework tables.

-- Base system schema. Module-specific tables live in later migration files.
-- CreateTable
CREATE TABLE `sys_app` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(100) NULL,
    `icon_color` VARCHAR(50) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(255) NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_app_name_key`(`name`),
    INDEX `idx_app_status`(`status`),
    INDEX `idx_app_created_at`(`created_at`),
    INDEX `idx_app_deleted_at`(`deleted_at`),
    INDEX `idx_app_sort_order`(`sort_order`),
    INDEX `sys_app_creator_id_idx`(`creator_id`),
    INDEX `sys_app_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_app_resource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `app_id` INTEGER NOT NULL,
    `parent_id` INTEGER NULL,
    `type` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_app_resource_app_id`(`app_id`),
    INDEX `idx_app_resource_parent_id`(`parent_id`),
    INDEX `idx_app_resource_type`(`type`),
    INDEX `idx_app_resource_status`(`status`),
    INDEX `idx_app_resource_deleted_at`(`deleted_at`),
    INDEX `idx_app_resource_sort_order`(`sort_order`),
    INDEX `sys_app_resource_creator_id_idx`(`creator_id`),
    INDEX `sys_app_resource_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_form_field` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `resource_id` INTEGER NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `label` VARCHAR(100) NULL,
    `type` VARCHAR(50) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_form_field_resource_id`(`resource_id`),
    INDEX `idx_form_field_status`(`status`),
    INDEX `idx_form_field_deleted_at`(`deleted_at`),
    INDEX `idx_form_field_sort_order`(`sort_order`),
    INDEX `sys_form_field_creator_id_idx`(`creator_id`),
    INDEX `sys_form_field_updater_id_idx`(`updater_id`),
    UNIQUE INDEX `uniq_form_field_resource_key`(`resource_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_form_data` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `resource_id` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_form_data_resource_id`(`resource_id`),
    INDEX `idx_form_data_status`(`status`),
    INDEX `idx_form_data_created_at`(`created_at`),
    INDEX `idx_form_data_deleted_at`(`deleted_at`),
    INDEX `sys_form_data_creator_id_idx`(`creator_id`),
    INDEX `sys_form_data_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_app_menu` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `app_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `path` VARCHAR(255) NULL,
    `icon` VARCHAR(100) NULL,
    `component` VARCHAR(255) NULL,
    `type` TINYINT NOT NULL DEFAULT 1,
    `parent_id` INTEGER NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `hide_in_menu` BOOLEAN NOT NULL DEFAULT false,
    `is_external_link` BOOLEAN NOT NULL DEFAULT false,
    `keep_alive` BOOLEAN NOT NULL DEFAULT false,
    `resource_id` INTEGER NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_app_menu_app_id`(`app_id`),
    INDEX `idx_app_menu_resource_id`(`resource_id`),
    INDEX `idx_app_menu_status`(`status`),
    INDEX `idx_app_menu_created_at`(`created_at`),
    INDEX `idx_app_menu_deleted_at`(`deleted_at`),
    INDEX `idx_app_menu_parent_id`(`parent_id`),
    INDEX `idx_app_menu_sort_order`(`sort_order`),
    INDEX `sys_app_menu_updater_id_idx`(`updater_id`),
    INDEX `sys_app_menu_creator_id_idx`(`creator_id`),
    UNIQUE INDEX `uniq_app_menu_app_parent_name`(`app_id`, `parent_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable

CREATE TABLE `sys_region` (
    `code` INTEGER NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `level` TINYINT NOT NULL,
    `parent_code` INTEGER NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_sys_region_parent`(`parent_code`),
    INDEX `idx_sys_region_level`(`level`),
    INDEX `idx_sys_region_status`(`status`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable

CREATE TABLE `sys_option` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NULL,
    `description` VARCHAR(255) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_option_key_key`(`key`),
    INDEX `idx_option_key`(`key`),
    INDEX `idx_option_status`(`status`),
    INDEX `idx_option_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `real_name` VARCHAR(50) NULL,
    `nickname` VARCHAR(50) NULL,
    `avatar` VARCHAR(500) NULL,
    `gender` TINYINT NOT NULL DEFAULT 0,
    `birth_date` DATE NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `last_login_time` DATETIME(0) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `login_count` INTEGER NOT NULL DEFAULT 0,
    `creator_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE `sys_user_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `access_token` VARCHAR(512) NOT NULL,
    `refresh_token` VARCHAR(512) NOT NULL,
    `access_token_expires_at` DATETIME(0) NOT NULL,
    `refresh_token_expires_at` DATETIME(0) NOT NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `revoked_at` DATETIME(0) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_user_token_user_id`(`user_id`),
    INDEX `idx_is_revoked`(`is_revoked`),
    INDEX `idx_access_token_expires`(`access_token_expires_at`),
    INDEX `idx_refresh_token_expires`(`refresh_token_expires_at`),
    INDEX `idx_user_revoked`(`user_id`, `is_revoked`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_login_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `username` VARCHAR(100) NOT NULL,
    `real_name` VARCHAR(50) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `message` VARCHAR(255) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_login_log_user_id`(`user_id`),
    INDEX `idx_login_log_username`(`username`),
    INDEX `idx_login_log_status`(`status`),
    INDEX `idx_login_log_created_at`(`created_at`),
    INDEX `idx_login_log_ip_address`(`ip_address`),
    INDEX `idx_login_log_deleted_at`(`deleted_at`),
    INDEX `idx_login_log_status_created_at`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NULL,
    `description` VARCHAR(255) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `data_scope` TINYINT NOT NULL DEFAULT 1,
    `is_system_default` BOOLEAN NOT NULL DEFAULT false,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_role_name_key`(`name`),
    UNIQUE INDEX `uniq_role_code`(`code`),
    INDEX `idx_role_status`(`status`),
    INDEX `idx_role_created_at`(`created_at`),
    INDEX `idx_role_deleted_at`(`deleted_at`),
    INDEX `sys_role_creator_id_idx`(`creator_id`),
    INDEX `sys_role_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user_role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_user_role_user_id`(`user_id`),
    INDEX `idx_user_role_role_id`(`role_id`),
    UNIQUE INDEX `uniq_user_role`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_user_dept` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `dept_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_user_dept_user_id`(`user_id`),
    INDEX `idx_user_dept_dept_id`(`dept_id`),
    UNIQUE INDEX `uniq_user_dept`(`user_id`, `dept_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dept` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `parent_id` INTEGER NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(255) NULL,
    `leader_id` INTEGER NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_dept_name_key`(`name`),
    INDEX `idx_dept_status`(`status`),
    INDEX `idx_dept_created_at`(`created_at`),
    INDEX `idx_dept_deleted_at`(`deleted_at`),
    INDEX `idx_dept_parent_id`(`parent_id`),
    INDEX `idx_dept_sort_order`(`sort_order`),
    INDEX `sys_dept_leader_id_idx`(`leader_id`),
    INDEX `sys_dept_creator_id_idx`(`creator_id`),
    INDEX `sys_dept_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_post` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(255) NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_post_name_key`(`name`),
    INDEX `idx_post_status`(`status`),
    INDEX `idx_post_created_at`(`created_at`),
    INDEX `idx_post_deleted_at`(`deleted_at`),
    INDEX `idx_post_sort_order`(`sort_order`),
    INDEX `sys_post_creator_id_idx`(`creator_id`),
    INDEX `sys_post_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_menu` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `path` VARCHAR(255) NULL,
    `icon` VARCHAR(100) NULL,
    `component` VARCHAR(255) NULL,
    `type` TINYINT NOT NULL DEFAULT 1,
    `parent_id` INTEGER NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `hide_in_menu` BOOLEAN NOT NULL DEFAULT false,
    `is_default_action` BOOLEAN NOT NULL DEFAULT false,
    `is_external_link` BOOLEAN NOT NULL DEFAULT false,
    `keep_alive` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(20) NOT NULL DEFAULT 'custom',
    `plugin_name` VARCHAR(100) NULL,
    `plugin_menu_key` VARCHAR(255) NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_menu_path_key`(`path`),
    INDEX `idx_menu_status`(`status`),
    INDEX `idx_menu_created_at`(`created_at`),
    INDEX `idx_menu_deleted_at`(`deleted_at`),
    INDEX `idx_menu_parent_id`(`parent_id`),
    INDEX `idx_menu_sort_order`(`sort_order`),
    INDEX `sys_menu_updater_id_idx`(`updater_id`),
    INDEX `sys_menu_creator_id_idx`(`creator_id`),
    INDEX `idx_menu_plugin_name`(`plugin_name`),
    INDEX `idx_menu_source`(`source`),
    UNIQUE INDEX `uniq_menu_parent_name`(`parent_id`, `name`),
    UNIQUE INDEX `uniq_plugin_menu_key`(`plugin_menu_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_menu_permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `menu_id` INTEGER NOT NULL,
    `permission_code` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_menu_permission_menu_id`(`menu_id`),
    INDEX `idx_menu_permission_code`(`permission_code`),
    UNIQUE INDEX `uniq_menu_permission`(`menu_id`, `permission_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_role_menu` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `menu_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_role_menu_role_id`(`role_id`),
    INDEX `idx_role_menu_menu_id`(`menu_id`),
    UNIQUE INDEX `uniq_role_menu`(`role_id`, `menu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
-- 角色的后端能力授权。与 sys_role_menu 明确分离：菜单只控制导航可见性，
-- 这里的 permission_code 才是 requirePermission() 的授权事实来源。
CREATE TABLE `sys_role_permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `permission_code` VARCHAR(128) NOT NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    INDEX `idx_role_permission_role_id`(`role_id`),
    INDEX `idx_role_permission_code`(`permission_code`),
    UNIQUE INDEX `uniq_role_permission`(`role_id`, `permission_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `remark` VARCHAR(255) NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_dict_type_type_key`(`type`),
    INDEX `idx_dict_type_status`(`status`),
    INDEX `idx_dict_type_created_at`(`created_at`),
    INDEX `idx_dict_type_deleted_at`(`deleted_at`),
    INDEX `idx_dict_type_sort_order`(`sort_order`),
    INDEX `sys_dict_type_creator_id_idx`(`creator_id`),
    INDEX `sys_dict_type_updater_id_idx`(`updater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_dict_data` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_id` INTEGER NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `tag` VARCHAR(50) NULL,
    `remark` VARCHAR(255) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_dict_data_type_id`(`type_id`),
    INDEX `idx_dict_data_status`(`status`),
    INDEX `idx_dict_data_created_at`(`created_at`),
    INDEX `idx_dict_data_deleted_at`(`deleted_at`),
    INDEX `idx_dict_data_sort_order`(`sort_order`),
    INDEX `sys_dict_data_creator_id_idx`(`creator_id`),
    INDEX `sys_dict_data_updater_id_idx`(`updater_id`),
    UNIQUE INDEX `uniq_dict_data_value`(`type_id`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_attachment_folder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `parent_id` INTEGER NULL,
    `kind` TINYINT NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `remark` VARCHAR(255) NULL,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_attachment_folder_kind`(`kind`),
    INDEX `idx_attachment_folder_status`(`status`),
    INDEX `idx_attachment_folder_created_at`(`created_at`),
    INDEX `idx_attachment_folder_deleted_at`(`deleted_at`),
    INDEX `idx_attachment_folder_parent_id`(`parent_id`),
    INDEX `idx_attachment_folder_sort_order`(`sort_order`),
    INDEX `sys_attachment_folder_creator_id_idx`(`creator_id`),
    INDEX `sys_attachment_folder_updater_id_idx`(`updater_id`),
    UNIQUE INDEX `uniq_attachment_folder_parent_name`(`parent_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_attachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folder_id` INTEGER NULL,
    `kind` TINYINT NOT NULL DEFAULT 4,
    `name` VARCHAR(255) NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `ext` VARCHAR(20) NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `storage` VARCHAR(20) NOT NULL DEFAULT 'local',
    `path` VARCHAR(500) NULL,
    `url` VARCHAR(500) NULL,
    `object_key` VARCHAR(500) NULL,
    `hash` VARCHAR(64) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration` INTEGER NULL,
    `metadata` JSON NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `creator_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updater_id` INTEGER NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `idx_attachment_folder_id`(`folder_id`),
    INDEX `idx_attachment_kind`(`kind`),
    INDEX `idx_attachment_mime_type`(`mime_type`),
    INDEX `idx_attachment_storage`(`storage`),
    INDEX `idx_attachment_status`(`status`),
    INDEX `idx_attachment_created_at`(`created_at`),
    INDEX `idx_attachment_deleted_at`(`deleted_at`),
    INDEX `sys_attachment_creator_id_idx`(`creator_id`),
    INDEX `sys_attachment_updater_id_idx`(`updater_id`),
    UNIQUE INDEX `uniq_attachment_hash_storage`(`hash`, `storage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_plugin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plugin_id` VARCHAR(100) NULL,
    `org` VARCHAR(50) NULL,
    `slug` VARCHAR(50) NULL,
    `source` VARCHAR(30) NULL,
    `name` VARCHAR(100) NULL,
    `current_version` VARCHAR(50) NOT NULL,
    `core_compatibility` VARCHAR(50) NULL,
    `compat_range` VARCHAR(100) NULL,
    `route_base` VARCHAR(255) NULL,
    `lifecycle_state` VARCHAR(30) NOT NULL DEFAULT 'discovered',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `installed_at` DATETIME(0) NULL,
    `last_synced_at` DATETIME(0) NULL,
    `last_error` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `sys_plugin_plugin_id_key`(`plugin_id`),
    INDEX `idx_sys_plugin_enabled`(`enabled`),
    INDEX `idx_sys_plugin_lifecycle_state`(`lifecycle_state`),
    INDEX `idx_sys_plugin_updated_at`(`updated_at`),
    INDEX `idx_sys_plugin_plugin_id`(`plugin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_plugin_version` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plugin_id` INTEGER NOT NULL,
    `version` VARCHAR(50) NOT NULL,
    `manifest` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_sys_plugin_version_plugin_id`(`plugin_id`),
    UNIQUE INDEX `uniq_sys_plugin_version`(`plugin_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_plugin_install` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plugin_id` INTEGER NOT NULL,
    `lifecycle_state` VARCHAR(30) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `installed_at` DATETIME(0) NULL,
    `uninstalled_at` DATETIME(0) NULL,
    `last_error` VARCHAR(500) NULL,
    `sync_strategy` VARCHAR(20) NULL DEFAULT 'safe',
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `sys_plugin_install_plugin_id_key`(`plugin_id`),
    INDEX `idx_sys_plugin_install_plugin_id`(`plugin_id`),
    INDEX `idx_sys_plugin_install_enabled`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_plugin_config_snapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plugin_id` INTEGER NOT NULL,
    `version` VARCHAR(50) NOT NULL,
    `config` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_sys_plugin_config_snapshot_plugin_id`(`plugin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_plugin_sync_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plugin_install_id` INTEGER NOT NULL,
    `strategy` VARCHAR(20) NOT NULL DEFAULT 'safe',
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `created` INTEGER NOT NULL DEFAULT 0,
    `updated` INTEGER NOT NULL DEFAULT 0,
    `skipped` INTEGER NOT NULL DEFAULT 0,
    `conflicted` INTEGER NOT NULL DEFAULT 0,
    `conflict_details` JSON NULL,
    `error_message` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_sys_plugin_sync_log_plugin_install_id`(`plugin_install_id`),
    INDEX `idx_sys_plugin_sync_log_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `sys_api_token` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `scopes` JSON NULL,
    `token_hash` CHAR(64) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `expires_at` DATETIME(0) NULL,
    `last_used_at` DATETIME(0) NULL,
    `last_used_ip` VARCHAR(45) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `sys_api_token_token_hash_key`(`token_hash`),
    INDEX `idx_api_token_user_id`(`user_id`),
    INDEX `idx_api_token_deleted_at`(`deleted_at`),
    INDEX `idx_api_token_expires_at`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
