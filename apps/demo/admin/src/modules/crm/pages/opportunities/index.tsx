import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { OPPORTUNITY_STAGES } from '@/modules/crm/domain/statuses';
import { listOpportunities, type OpportunityRow } from '@/services/crm';
import OpportunityAdvanceModal, {
  OPPORTUNITY_CHANGED_EVENT,
} from '../../components/opportunity/OpportunityAdvanceModal';
import OpportunityDetailModal from '../../components/opportunity/OpportunityDetailModal';
import OpportunitySave from '../../components/opportunity/OpportunitySave';
import { formatMoney } from '../_shared/CrmEntityList';

export default function OpportunitiesPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { initialState } = useModel('@@initialState');
  const requestVersion = useRef(0);
  const [selected, setSelected] = useState<OpportunityRow | null>(null);
  useEffect(() => {
    const reload = () => {
      requestVersion.current += 1;
      void actionRef.current?.reload();
    };
    window.addEventListener(OPPORTUNITY_CHANGED_EVENT, reload);
    return () => window.removeEventListener(OPPORTUNITY_CHANGED_EVENT, reload);
  }, []);
  const columns: ProColumns<OpportunityRow>[] = [
    {
      title: '商机名称',
      dataIndex: 'name',
      render: (_, row) => (
        <div style={{ minWidth: 0 }}>
          <a onClick={() => setSelected(row)}>{row.name}</a>
          <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
            {row.opportunityNo || `OPP-${row.id}`}
          </div>
        </div>
      ),
    },
    { title: '客户', dataIndex: 'customerName', search: false },
    {
      title: '阶段',
      dataIndex: 'stage',
      valueEnum: Object.fromEntries(
        OPPORTUNITY_STAGES.map((item) => [item.value, item.label]),
      ),
    },
    {
      title: '预计金额',
      dataIndex: 'amountCents',
      search: false,
      render: (_, row) => formatMoney(row.amountCents),
    },
    {
      title: '预计成交',
      dataIndex: 'expectedCloseDate',
      valueType: 'date',
      search: false,
    },
    { title: '负责人', dataIndex: 'ownerName', search: false },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      render: (_, row) => (
        <OpportunityAdvanceModal
          compact
          opportunity={row}
          onRefresh={(updated) => {
            if (updated)
              setSelected((current) =>
                current?.id === updated.id
                  ? {
                      ...current,
                      ...updated,
                      customerName:
                        updated.customerName || current.customerName,
                      ownerName: updated.ownerName || current.ownerName,
                    }
                  : current,
              );
          }}
        />
      ),
    },
  ];
  return (
    <PageContainer>
      <ProTable<OpportunityRow>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="商机列表"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        request={async (params) => {
          const version = ++requestVersion.current;
          const result = await listOpportunities({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.name,
            stage: params.stage,
          });
          setSelected((current) => {
            if (!current || version !== requestVersion.current) return current;
            const row = result.data.find((item) => item.id === current.id);
            return row ?? current;
          });
          return { ...result, success: true };
        }}
        toolBarRender={() => [
          <OpportunitySave
            key="create"
            ownerId={initialState?.currentUser?.id}
            onFinish={() => actionRef.current?.reload()}
          >
            <Button type="primary" icon={<PlusOutlined />}>
              新建商机
            </Button>
          </OpportunitySave>,
        ]}
      />
      <OpportunityDetailModal
        opportunity={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onRefresh={(updated) => {
          if (updated)
            setSelected((current) =>
              current?.id === updated.id
                ? {
                    ...current,
                    ...updated,
                    customerName: updated.customerName || current.customerName,
                    ownerName: updated.ownerName || current.ownerName,
                  }
                : current,
            );
        }}
      />
    </PageContainer>
  );
}
