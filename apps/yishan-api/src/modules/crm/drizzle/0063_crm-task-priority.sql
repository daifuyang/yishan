-- 任务表：补 priority 列。
--
-- priority：normal / high / urgent（MVP 3 档）；UI 不暴露 overdue（计算状态）。

ALTER TABLE `crm_task`
  ADD COLUMN `priority` VARCHAR(16) NOT NULL DEFAULT 'normal';
CREATE INDEX `idx_crm_task_priority` ON `crm_task` (`priority`);