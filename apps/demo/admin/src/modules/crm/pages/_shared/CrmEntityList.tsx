import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import React, { useMemo, useState } from 'react';
import EntityDetailDrawer from '@/modules/crm/components/drawer/EntityDetailDrawer';

type Row = { id: number };

export interface CrmEntityListProps<T extends Row> {
  title: string;
  columns: ProColumns<T>[];
  load: (query: { page?: number; pageSize?: number; keyword?: string }) => Promise<{ data: T[]; total: number }>;
  fields: Array<{ key: keyof T; label: string; render?: (value: T[keyof T], record: T) => React.ReactNode }>;
  onCreate?: () => void;
  createAction?: React.ReactNode;
  actionRef?: React.MutableRefObject<ActionType | undefined>;
}

export function CrmEntityList<T extends Row>({ title, columns, load, fields, onCreate, createAction, actionRef }: CrmEntityListProps<T>) {
  const [selected, setSelected] = useState<T | null>(null);
  const tableColumns = useMemo<ProColumns<T>[]>(() => [
    ...columns,
    {
      title: '操作',
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      render: (_, row) => <a onClick={() => setSelected(row)}>查看</a>,
    },
  ], [columns]);

  return (
    <PageContainer header={{ title }}>
      <ProTable<T>
        actionRef={actionRef}
        headerTitle={`${title}列表`}
        rowKey="id"
        columns={tableColumns}
        search={{ labelWidth: 'auto' }}
        request={async (params) => {
          const result = await load({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { ...result, success: true };
        }}
        toolBarRender={() => createAction ? [createAction as React.ReactElement] : onCreate ? [<Button key="create" type="primary" onClick={onCreate}>新建</Button>] : []}
      />
      <EntityDetailDrawer open={selected !== null} title={`${title}详情`} record={selected} onClose={() => setSelected(null)} fields={fields} />
    </PageContainer>
  );
}

export const formatMoney = (cents: number | null | undefined) => `\u00a5${((cents ?? 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
