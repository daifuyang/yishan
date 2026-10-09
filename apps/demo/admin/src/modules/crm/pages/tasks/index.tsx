import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listTasks, type TaskRow } from '@/services/crm';
import { TASK_STATUSES } from '@/modules/crm/domain/statuses';
import { CrmEntityList } from '../_shared/CrmEntityList';

const columns: ProColumns<TaskRow>[] = [
  { title: '任务', dataIndex: 'title' },
  { title: '客户', dataIndex: 'customerId', search: false },
  { title: '状态', dataIndex: 'status', valueEnum: Object.fromEntries(TASK_STATUSES.map((item) => [item.value, item.label])) },
  { title: '截止时间', dataIndex: 'dueAt', valueType: 'dateTime', search: false },
  { title: '说明', dataIndex: 'description', search: false },
];
export default function TasksPage() {
  return <CrmEntityList title="任务" columns={columns} load={listTasks} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof TaskRow, label: String(column.title) }))} />;
}
