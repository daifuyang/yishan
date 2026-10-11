-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: yishan
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `crm_opportunity`
--

DROP TABLE IF EXISTS `crm_opportunity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_opportunity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` int NOT NULL,
  `contact_id` int DEFAULT NULL,
  `owner_user_id` int DEFAULT NULL,
  `primary_contact_id` int DEFAULT NULL,
  `owner_id` int DEFAULT NULL,
  `owner_department_id` int DEFAULT NULL,
  `pipeline_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `stage_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'discover',
  `stage` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'requirement',
  `stage_entered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expected_amount_cents` bigint NOT NULL DEFAULT '0',
  `amount_cents` bigint DEFAULT NULL,
  `expected_close_date` datetime DEFAULT NULL,
  `next_action_at` datetime DEFAULT NULL,
  `lost_reason_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lost_reason` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `won_at` datetime DEFAULT NULL,
  `lost_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `creator_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updater_id` int DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `requirement` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `next_action` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `next_follow_up_at` datetime DEFAULT NULL,
  `remark` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crm_opportunity_customer_id` (`customer_id`),
  KEY `idx_crm_opportunity_deleted_at` (`deleted_at`),
  KEY `idx_crm_opportunity_created_at` (`created_at`),
  KEY `idx_crm_opportunity_primary_contact_id` (`primary_contact_id`),
  KEY `idx_crm_opportunity_customer_stage` (`customer_id`,`stage`),
  KEY `idx_crm_opportunity_contact_id` (`contact_id`),
  KEY `idx_crm_opportunity_owner_stage` (`owner_user_id`,`stage_code`),
  KEY `idx_crm_opportunity_pipeline_stage` (`pipeline_code`,`stage_code`),
  KEY `idx_crm_opportunity_stage` (`stage_code`),
  KEY `idx_crm_opportunity_next_action_at` (`next_action_at`),
  KEY `idx_crm_opportunity_pipeline_stage_entered` (`pipeline_code`,`stage_code`,`stage_entered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_opportunity`
--

LOCK TABLES `crm_opportunity` WRITE;
/*!40000 ALTER TABLE `crm_opportunity` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_opportunity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crm_opportunity_stage_log`
--

DROP TABLE IF EXISTS `crm_opportunity_stage_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `crm_opportunity_stage_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opportunity_id` int NOT NULL,
  `from_stage` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_stage` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `operator_user_id` int NOT NULL,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_crm_opportunity_stage_log_opportunity_id` (`opportunity_id`),
  KEY `idx_crm_opportunity_stage_log_created_at` (`created_at`),
  KEY `idx_crm_opportunity_stage_log_opportunity_created` (`opportunity_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crm_opportunity_stage_log`
--

LOCK TABLES `crm_opportunity_stage_log` WRITE;
/*!40000 ALTER TABLE `crm_opportunity_stage_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `crm_opportunity_stage_log` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-06 15:23:19
