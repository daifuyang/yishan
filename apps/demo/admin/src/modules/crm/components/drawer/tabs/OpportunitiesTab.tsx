import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { OPPORTUNITY_STAGES } from '@/modules/crm/domain/statuses';
import type { CustomerDetail, OpportunityRow } from '@/services/crm';
import { listContactsByCustomer, listOpportunities } from '@/services/crm';
import { usePermission } from '@/utils/permission';
import OpportunityAdvanceModal from '../../opportunity/OpportunityAdvanceModal';
import OpportunityDetailModal from '../../opportunity/OpportunityDetailModal';
import OpportunityCreateModal from './OpportunityCreateModal';

export interface OpportunitiesTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  onCreateRequest?: () => void;
  onRefresh?: () => void | Promise<void>;
}

export default function OpportunitiesTab({
  customer,
  refreshKey,
  onCreateRequest,
  onRefresh,
}: OpportunitiesTabProps) {
  const can = usePermission();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const requestVersion = useRef(0);
  const [selected, setSelected] = useState<OpportunityRow | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    actionRef.current?.reload();
  }, [refreshKey, customer.id]);
  const refresh = async (updated?: OpportunityRow) => {
    requestVersion.current += 1;
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
    const results = await Promise.allSettled([
      actionRef.current?.reload(),
      onRefresh?.(),
    ]);
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('商机或客户信息刷新失败');
  };
  const columns: ProColumns<OpportunityRow>[] = [
    {
      title: '商机名称',
      dataIndex: 'name',
      width: 220,
      ellipsis: true,
      render: (_, row) => (
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Typography.Link
            ellipsis
            title={row.name}
            onClick={() => setSelected({ ...row, customerName: customer.name })}
          >
            {row.name}
          </Typography.Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.opportunityNo || `OPP-${row.id}`}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      width: 110,
      valueEnum: Object.fromEntries(
        OPPORTUNITY_STAGES.map((item) => [
          item.value,
          { text: item.label, status: item.semantic },
        ]),
      ),
    },
    {
      title: '预计金额',
      dataIndex: 'amountCents',
      width: 140,
      align: 'right',
      render: (_, row) =>
        row.amountCents == null
          ? '—'
          : `¥${(row.amountCents / 100).toLocaleString('zh-CN')}`,
    },
    {
      title: '预计成交',
      dataIndex: 'expectedCloseDate',
      width: 110,
      render: (_, row) =>
        row.expectedCloseDate
          ? dayjs(row.expectedCloseDate).format(
              dayjs(row.expectedCloseDate).year() === dayjs().year()
                ? 'MM-DD'
                : 'YYYY-MM-DD',
            )
          : '—',
    },
    {
      title: '负责人',
      dataIndex: 'ownerName',
      width: 88,
      renderText: (value) => value || '—',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 104,
      fixed: 'right',
      render: (_, row) =>
        ['negotiation', 'won', 'lost'].includes(row.stage) ? (
          '—'
        ) : (
          <OpportunityAdvanceModal
            compact
            opportunity={row}
            onRefresh={refresh}
          />
        ),
    },
  ];
  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        style={{ minHeight: 40, marginBottom: 8 }}
      >
        <Flex align="baseline" gap={8}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            商机
          </Typography.Text>
          <Typography.Text type="secondary">{total}</Typography.Text>
        </Flex>
        {can('crm:opportunity:create') && onCreateRequest && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateRequest}
          >
            新建商机
          </Button>
        )}
      </Flex>
      <ProTable<OpportunityRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          const version = ++requestVersion.current;
          const result = await listOpportunities({
            customerId: customer.id,
            page: 1,
            pageSize: 100,
          });
          if (version === requestVersion.current) setTotal(result.total);
          setSelected((current) => {
            if (!current || version !== requestVersion.current) return current;
            const row = result.data.find((item) => item.id === current.id);
            return row ? { ...row, customerName: customer.name } : null;
          });
          return { ...result, success: true };
        }}
        search={false}
        pagination={false}
        options={false}
        toolBarRender={false}
        cardBordered={false}
        scroll={{ x: 760 }}
        size="small"
      />
      <OpportunityDetailModal
        opportunity={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        primaryContactName={
          selected?.primaryContactId === customer.primaryContactId
            ? customer.primaryContactName
            : null
        }
        sourceName={
          selected?.sourceId != null && selected.sourceId === customer.sourceId
            ? customer.sourceName
            : null
        }
        onRefresh={refresh}
      />
    </>
  );
}

/**
 * OpportunitiesTab 的 standalone 包装：自己拉 listOpportunities，
 * 因为 Drawer 上下文需要把 ModalForm 状态提到父级。
 *
 * 写操作（create）走父级提供的 ModalForm（onCreateRequest / onModalOpenChange
 * 控制开关），刷新通过 refreshKey 触发。
 */
interface OpportunitiesTabStandaloneProps {
  customer: CustomerDetail;
  refreshKey: number;
  createOpen: boolean;
  onCreateRequest: () => void;
  onModalOpenChange: (open: boolean) => void;
  /** 创建成功回调：父级用它刷新客户详情 + 商机列表 refreshKey。 */
  onOpportunityCreated?: () => void | Promise<void>;
}

export function OpportunitiesTabStandalone({
  customer,
  refreshKey,
  createOpen,
  onCreateRequest,
  onModalOpenChange,
  onOpportunityCreated,
}: OpportunitiesTabStandaloneProps) {
  const [contacts, setContacts] = useState<
    import('@/services/crm').ContactRow[]
  >([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // 拉联系人（用于 Modal 默认选主联系人 / 单联系人）。
  useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    listContactsByCustomer(customer.id)
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  return (
    <>
      <OpportunitiesTab
        customer={customer}
        refreshKey={refreshKey}
        onCreateRequest={onCreateRequest}
        onRefresh={onOpportunityCreated}
      />
      <OpportunityCreateModal
        open={createOpen}
        onOpenChange={onModalOpenChange}
        customerId={customer.id}
        ownerId={customer.ownerUserId}
        existingContacts={contactsLoading ? [] : contacts}
        onSuccess={() => {
          void onOpportunityCreated?.();
        }}
      />
    </>
  );
}
