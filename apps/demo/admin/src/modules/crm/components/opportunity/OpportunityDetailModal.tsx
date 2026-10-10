import { type ActionType, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Divider,
  Empty,
  Flex,
  Modal,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import type { ActivityRow, ContractRow, OpportunityRow, QuoteSeriesSummary } from '@/services/crm';
import {
  listAllPages,
  listActivitiesByCustomer,
  listContactsByCustomer,
  listContracts,
  listQuotations,
} from '@/services/crm';
import {
  OPEN_OPPORTUNITY_STAGES,
  opportunityStageConfig,
  QUOTATION_STATUSES,
  statusOf,
} from '../../domain/statuses';
import { formatQuoteMoney } from '../../utils/quotationMoney';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';
import QuoteDetailModal, {
  QUOTATION_CHANGED_EVENT,
} from '../quotation/QuoteDetailModal';
import OpportunityAdvanceModal from './OpportunityAdvanceModal';

interface Props {
  opportunity: OpportunityRow | null;
  open: boolean;
  onClose: () => void;
  onRefresh: (updated?: OpportunityRow) => void | Promise<void>;
  primaryContactName?: string | null;
  sourceName?: string | null;
}

export default function OpportunityDetailModal(props: Props) {
  return props.opportunity && props.open ? (
    <OpportunityDetail
      key={props.opportunity.id}
      {...props}
      opportunity={props.opportunity}
    />
  ) : null;
}

function OpportunityDetail({
  opportunity,
  open,
  onClose,
  onRefresh,
  primaryContactName,
  sourceName,
}: Props & { opportunity: OpportunityRow }) {
  const { token } = theme.useToken();
  const [contactName, setContactName] = useState(primaryContactName);
  const [quotationCount, setQuotationCount] = useState(0);
  const quotationTableRef = useRef<ActionType | undefined>(undefined);
  const [quotationPageError, setQuotationPageError] = useState(false);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [stageActivities, setStageActivities] = useState<ActivityRow[]>([]);
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  useEffect(() => {
    const reload = () => setQuoteRefreshKey((value) => value + 1);
    window.addEventListener(QUOTATION_CHANGED_EVENT, reload);
    return () => window.removeEventListener(QUOTATION_CHANGED_EVENT, reload);
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({
    quotation: false,
    contract: false,
  });
  const [related, setRelated] = useState<'quotation' | 'contract' | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErrors({ quotation: false, contract: false });
    setContactName(primaryContactName);
    void Promise.allSettled([
      listContactsByCustomer(opportunity.customerId),
      listQuotations({
        customerId: opportunity.customerId,
        opportunityId: opportunity.id,
        page: 1,
        pageSize: 1,
      }),
      listAllPages((page, pageSize) =>
        listContracts({ customerId: opportunity.customerId, page, pageSize }),
      ),
      listActivitiesByCustomer(opportunity.customerId),
    ]).then(([contacts, quotes, deals, activities]) => {
      if (cancelled) return;
      if (contacts.status === 'fulfilled')
        setContactName(
          contacts.value.find(
            (contact) => contact.id === opportunity.primaryContactId,
          )?.name ?? primaryContactName,
        );
      if (quotes.status === 'fulfilled') setQuotationCount(quotes.value.total);
      if (deals.status === 'fulfilled')
        setContracts(
          deals.value.filter((row) => row.opportunityId === opportunity.id),
        );
      if (activities.status === 'fulfilled') {
        setStageActivities(
          activities.value.items.filter((item) => {
            const metadata = item.metadata;
            const opportunityId =
              metadata && typeof metadata.opportunityId === 'number'
                ? metadata.opportunityId
                : metadata && typeof metadata.opportunityId === 'string'
                  ? Number(metadata.opportunityId)
                  : null;
            return (
              opportunityId === opportunity.id &&
              ['opportunity_created', 'opportunity_stage_changed', 'opportunity_won', 'opportunity_lost'].includes(item.type)
            );
          }),
        );
      }
      setLoadErrors({
        quotation: quotes.status === 'rejected',
        contract: deals.status === 'rejected',
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    opportunity.id,
    opportunity.customerId,
    opportunity.primaryContactId,
    opportunity.stage,
    quoteRefreshKey,
    primaryContactName,
  ]);
  const stage = opportunityStageConfig[opportunity.stage];
  const current =
    opportunity.stage === 'won'
      ? OPEN_OPPORTUNITY_STAGES.length
      : OPEN_OPPORTUNITY_STAGES.findIndex(
          (item) => item.value === opportunity.stage,
        );
  const metrics = [
    {
      label: '预计金额',
      value:
        opportunity.amountCents == null
          ? '—'
          : `¥${(opportunity.amountCents / 100).toLocaleString('zh-CN')}`,
    },
    {
      label: '预计成交',
      value: opportunity.expectedCloseDate
        ? dayjs(opportunity.expectedCloseDate).format('YYYY-MM-DD')
        : '—',
    },
    { label: '负责人', value: opportunity.ownerName || '—' },
  ];
  return (
    <>
      <Modal
        open={open}
        width="min(900px, calc(100vw - 32px))"
        zIndex={CRM_DIALOG_Z_INDEX}
        styles={{
          body: {
            overflowX: 'hidden',
          },
        }}
        title={
          <Flex vertical gap={4} style={{ paddingRight: 24 }}>
            <Flex align="center" wrap gap={8}>
              <Typography.Text
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  overflowWrap: 'anywhere',
                }}
              >
                {opportunity.name}
              </Typography.Text>
              <Tag color={stage.semantic}>{stage.label}</Tag>
            </Flex>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 13, fontWeight: 400 }}
            >
              {opportunity.opportunityNo || `OPP-${opportunity.id}`}
              {' · '}
              {opportunity.customerName || '—'}
              {contactName ? ` · ${contactName}` : ''}
            </Typography.Text>
          </Flex>
        }
        onCancel={onClose}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <OpportunityAdvanceModal
              opportunity={opportunity}
              onRefresh={onRefresh}
            />
          </Space>
        }
      >
        <Flex wrap gap={40} style={{ margin: '24px 0' }}>
          {metrics.map((item) => (
            <Flex vertical gap={4} key={item.label}>
              <Typography.Text style={{ fontSize: 18, fontWeight: 600 }}>
                {item.value}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {item.label}
              </Typography.Text>
            </Flex>
          ))}
        </Flex>
        <Steps
          size="small"
          current={current}
          items={OPEN_OPPORTUNITY_STAGES.map((item) => ({ title: item.label }))}
        />
        {stageActivities.length > 0 && (
          <Flex vertical gap={8} style={{ marginTop: 20 }}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              阶段记录
            </Typography.Text>
            {stageActivities.map((item) => (
              <Flex key={item.id} justify="space-between" gap={12}>
                <Typography.Text style={{ fontSize: 13 }}>
                  {item.content}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {item.occurredAt ? dayjs(item.occurredAt).format('MM-DD HH:mm') : '—'}
                </Typography.Text>
              </Flex>
            ))}
          </Flex>
        )}
        <Flex vertical gap={16} style={{ marginTop: 24 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            需求
          </Typography.Text>
          {[
            { label: '需求摘要', value: opportunity.requirement },
            { label: '竞争情况', value: opportunity.competition },
            { label: '备注', value: opportunity.remark },
          ].map((item) => (
            <Flex vertical gap={4} key={item.label}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {item.label}
              </Typography.Text>
              <Typography.Text
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {item.value || '—'}
              </Typography.Text>
            </Flex>
          ))}
          {sourceName && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              来源：{sourceName}
            </Typography.Text>
          )}
        </Flex>
        <Divider style={{ borderColor: token.colorBorderSecondary }} />
        {(loadErrors.quotation || loadErrors.contract) && (
          <Alert
            type="warning"
            title="部分关联信息暂不可用，请检查查看权限或重新打开商机"
            style={{ marginBottom: 12 }}
          />
        )}
        <Flex gap={40}>
          <Space>
            {(loading || loadErrors.quotation) && (
              <Typography.Text>报价</Typography.Text>
            )}
            {loading ? (
              <Spin size="small" />
            ) : loadErrors.quotation ? (
              <Typography.Text type="secondary">—</Typography.Text>
            ) : (
              <Typography.Link onClick={() => setRelated('quotation')}>
                查看报价（{quotationCount}）
              </Typography.Link>
            )}
          </Space>
          <Space>
            <Typography.Text>合同</Typography.Text>
            {loading ? (
              <Spin size="small" />
            ) : loadErrors.contract ? (
              <Typography.Text type="secondary">—</Typography.Text>
            ) : contracts.length ? (
              <Typography.Link onClick={() => setRelated('contract')}>
                {contracts.length}
              </Typography.Link>
            ) : (
              <Typography.Text>0</Typography.Text>
            )}
          </Space>
        </Flex>
      </Modal>
      <QuoteDetailModal
        quotationId={quoteId}
        onClose={() => setQuoteId(null)}
        onChanged={() => onRefresh()}
      />
      {related && (
        <Modal
          open
          title={related === 'quotation' ? '关联报价' : '关联合同'}
          width="min(960px, calc(100vw - 32px))"
          styles={{
            container: {
              minHeight: 'min(420px, max(240px, calc(100dvh - 48px)))',
            },
            body: { flex: 1 },
          }}
          zIndex={CRM_DIALOG_Z_INDEX + 10}
          onCancel={() => setRelated(null)}
          footer={<Button onClick={() => setRelated(null)}>关闭</Button>}
        >
          {related === 'quotation' ? (
            <>
              {quotationPageError && (
                <Alert
                  type="error"
                  title="报价加载失败，请重试"
                  style={{ marginBottom: 12 }}
                  action={
                    <Button
                      size="small"
                      onClick={() => quotationTableRef.current?.reload()}
                    >
                      重试
                    </Button>
                  }
                />
              )}
              <ProTable<QuoteSeriesSummary>
                actionRef={quotationTableRef}
                cardProps={false}
                search={false}
                options={false}
                toolBarRender={false}
                params={{ refreshKey: quoteRefreshKey }}
                rowKey="seriesId"
                size="middle"
                scroll={{ x: 860 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无报价单"
                    />
                  ),
                }}
                pagination={{
                  defaultPageSize: 10,
                  hideOnSinglePage: true,
                  showSizeChanger: false,
                }}
                request={async (params) => {
                  setQuotationPageError(false);
                  const result = await listQuotations({
                    customerId: opportunity.customerId,
                    opportunityId: opportunity.id,
                    page: params.current,
                    pageSize: params.pageSize,
                  });
                  return { ...result, success: true };
                }}
                onRequestError={() => setQuotationPageError(true)}
                columns={[
                  {
                    title: '名称',
                    dataIndex: 'title',
                    render: (_, row) => (
                      <Typography.Link onClick={() => row.currentQuoteId != null && setQuoteId(row.currentQuoteId)}>
                        {row.title || row.seriesNo || '报价'}
                      </Typography.Link>
                    ),
                  },
                  {
                    title: '金额',
                    width: 120,
                    align: 'right',
                    render: (_, row) => formatQuoteMoney(row.currentAmount ?? 0),
                  },
                  {
                    title: '状态',
                    width: 100,
                    render: (_, row) => {
                      const status = statusOf(row.currentStatus ?? 'draft', QUOTATION_STATUSES);
                      return <Tag color={status.semantic}>{status.label}</Tag>;
                    },
                  },
                  {
                    title: '版本',
                    width: 120,
                    render: (_, row) =>
                      `${row.seriesNo ? `${row.seriesNo} · ` : ''}V${row.currentVersion ?? 1} · 共${row.versionCount ?? 1}版`,
                  },
                ]}
              />
            </>
          ) : (
            <Table<ContractRow>
              rowKey="id"
              size="middle"
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无合同"
                  />
                ),
              }}
              dataSource={contracts}
              columns={[
                { title: '合同编号', dataIndex: 'contractNo' },
                { title: '名称', dataIndex: 'name' },
                {
                  title: '金额',
                  render: (_, row) =>
                    `¥${(row.amountCents / 100).toLocaleString('zh-CN')}`,
                },
              ]}
            />
          )}
        </Modal>
      )}
    </>
  );
}
