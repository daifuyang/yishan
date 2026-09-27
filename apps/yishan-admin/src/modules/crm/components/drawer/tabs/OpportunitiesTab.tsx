import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Empty, Skeleton, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { OPPORTUNITY_STAGES, statusOf } from '@/modules/crm/domain/statuses';
import type { CustomerDetail, OpportunityRow } from '@/services/crm';
import { listContactsByCustomer, listOpportunities } from '@/services/crm';
import { usePermission } from '@/utils/permission';
import OpportunityCreateModal from './OpportunityCreateModal';

const money = (cents: number | null) =>
  cents === null
    ? '-'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);

const closeDate = (value: string | null) =>
  !value
    ? '-'
    : dayjs(value).year() === dayjs().year()
      ? dayjs(value).format('MM-DD')
      : dayjs(value).format('YYYY-MM-DD');

export interface OpportunitiesTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  /**
   * 「+ 新建商机」按钮的回调 —— 由父组件（CustomerDrawer）控制 Modal 打开。
   * 独立页面通过 `createAction` 走 `OpportunitySave` trigger 模式，不传本回调。
   */
  onCreateRequest?: () => void;
  /** 点击商机行的回调（跳详情）。 */
  onOpportunityClick?: (id: number) => void;
}

export default function OpportunitiesTab({
  customer,
  refreshKey,
  onCreateRequest,
  onOpportunityClick,
}: OpportunitiesTabProps) {
  const can = usePermission();
  const canCreate = can('crm:opportunity:create');

  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    void listOpportunities({ customerId: customer.id, page: 1, pageSize: 100 })
      .then((result) => setRows(result.data))
      .finally(() => setLoading(false));
  }, [customer.id, refreshKey]);

  const summary = useMemo(() => {
    const active = rows.filter(
      (row) => row.stage !== 'won' && row.stage !== 'lost',
    );
    const today = dayjs().startOf('day');
    const deadline = dayjs().add(30, 'day').endOf('day');
    return {
      activeCount: active.length,
      total: active.reduce((sum, row) => sum + (row.amountCents ?? 0), 0),
      next30: active
        .filter(
          (row) =>
            row.expectedCloseDate &&
            !dayjs(row.expectedCloseDate).isBefore(today) &&
            dayjs(row.expectedCloseDate).isBefore(deadline),
        )
        .reduce((sum, row) => sum + (row.amountCents ?? 0), 0),
    };
  }, [rows]);

  const columns: ProColumns<OpportunityRow>[] = useMemo(
    () => [
      {
        title: '商机名称',
        dataIndex: 'name',
        width: 220,
        render: (_, row) => (
          <a onClick={() => onOpportunityClick?.(row.id)}>{row.name}</a>
        ),
      },
      {
        title: '销售阶段',
        dataIndex: 'stage',
        width: 110,
        render: (_, row) => {
          const stage = statusOf(row.stage, OPPORTUNITY_STAGES);
          return (
            <Tag
              color={stage.semantic === 'default' ? undefined : stage.semantic}
            >
              {stage.label}
            </Tag>
          );
        },
      },
      {
        title: '预计金额',
        dataIndex: 'amountCents',
        width: 140,
        align: 'right',
        render: (_, row) => (
          <span style={{ fontWeight: 500 }}>{money(row.amountCents)}</span>
        ),
      },
      {
        title: '预计成交',
        dataIndex: 'expectedCloseDate',
        width: 110,
        render: (_, row) => closeDate(row.expectedCloseDate),
      },
      {
        title: '负责人',
        dataIndex: 'ownerName',
        width: 120,
        renderText: (value) => value || '-',
      },
      {
        title: '下一步',
        dataIndex: 'nextAction',
        width: 140,
        ellipsis: true,
        render: (_, row) =>
          row.nextAction ? (
            <Tooltip title={row.nextAction}>{row.nextAction}</Tooltip>
          ) : (
            '-'
          ),
      },
    ],
    [onOpportunityClick],
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
          marginBottom: rows.length ? 8 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>商机</span>
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>{rows.length}</span>
        </div>
        {canCreate && onCreateRequest && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateRequest}
          >
            新建商机
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无商机" />
      ) : (
        <>
          <div
            style={{
              height: 36,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              color: '#8c8c8c',
              fontSize: 13,
            }}
          >
            <span>
              有效商机{' '}
              <b style={{ color: '#262626', fontWeight: 500 }}>
                {summary.activeCount}
              </b>
            </span>
            <span>
              预计金额{' '}
              <b style={{ color: '#262626', fontWeight: 500 }}>
                {money(summary.total)}
              </b>
            </span>
            <span>
              未来30天预计成交{' '}
              <b style={{ color: '#262626', fontWeight: 500 }}>
                {money(summary.next30)}
              </b>
            </span>
          </div>
          <ProTable<OpportunityRow>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            search={false}
            pagination={false}
            options={false}
            toolBarRender={false}
            cardBordered={false}
            scroll={{ x: 760 }}
            size="small"
          />
        </>
      )}
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
