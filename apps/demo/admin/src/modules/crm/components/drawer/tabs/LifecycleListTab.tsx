import { Empty, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import type { StatusDescriptor } from '@/modules/crm/domain/statuses';

export interface LifecycleListTabProps<T extends { id: number }> {
  load: () => Promise<T[]>;
  columns: ColumnsType<T>;
  emptyText: string;
}

export function LifecycleListTab<T extends { id: number }>({ load, columns, emptyText }: LifecycleListTabProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void load().then((data) => active && setRows(data)).catch(() => active && setRows([])).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [load]);
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} style={{ margin: '32px 0' }} />;
  return <Table size="small" rowKey="id" pagination={false} columns={columns} dataSource={rows} />;
}

export const statusTag = (status: string, statuses: StatusDescriptor[]) => {
  const descriptor = statuses.find((item) => item.value === status) ?? { label: status, semantic: 'default' as const };
  return <Tag color={descriptor.semantic}>{descriptor.label}</Tag>;
};
