import React, { useCallback } from 'react';
import type { TaskRow } from '@/services/crm';
import { listTasks } from '@/services/crm';
import { LifecycleListTab, statusTag } from './LifecycleListTab';
const TasksTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const load = useCallback(() => listTasks({ customerId, page: 1, pageSize: 100 }).then((result) => result.data), [customerId]);
  return <LifecycleListTab<TaskRow> load={load} emptyText="暂无任务" columns={[{ title: '任务', dataIndex: 'title' }, { title: '状态', dataIndex: 'status', render: statusTag }, { title: '截止时间', dataIndex: 'dueAt' }, { title: '说明', dataIndex: 'description' }]} />;
};
export default TasksTab;
