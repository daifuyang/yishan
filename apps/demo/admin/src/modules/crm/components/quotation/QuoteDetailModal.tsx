import {
  Alert,
  Button,
  DatePicker,
  Divider,
  Dropdown,
  Flex,
  Modal,
  message,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import {
  createQuotationShare,
  confirmQuotation,
  getQuotation,
  type QuotationResp,
  revokeQuotationShare,
  sendQuotation,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import { QUOTATION_STATUSES, statusOf } from '../../domain/statuses';
import {
  OPPORTUNITY_CHANGED_EVENT,
  QUOTATION_CHANGED_EVENT,
} from '../../utils/crmEvents';
import { formatQuoteMoney } from '../../utils/quotationMoney';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';
import { getQuoteActions } from '../../domain/quoteActions';
import QuoteActions from './QuoteActions';
import QuoteFormModal from './QuoteFormModal';
import ContractCreateModal from '../drawer/tabs/ContractCreateModal';

export { QUOTATION_CHANGED_EVENT } from '../../utils/crmEvents';

export default function QuoteDetailModal({
  quotationId,
  onClose,
  onChanged,
  initialAction,
}: {
  quotationId: number | null;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
  initialAction?: 'generate';
}) {
  const can = usePermission();
  const [notice, noticeHolder] = message.useMessage();
  const [modal, contextHolder] = Modal.useModal();
  const [quote, setQuote] = useState<QuotationResp | null>(null);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [contractSource, setContractSource] = useState<QuotationResp | null>(null);
  const [expiryChoice, setExpiryChoice] = useState<
    'follow' | 'custom' | 3 | 7 | 14 | 30
  >('follow');
  const [customDate, setCustomDate] = useState<string>();
  const submitting = useRef(false);
  const shareSection = useRef<HTMLDivElement>(null);
  const handledShare = useRef(false);
  const versionRequest = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const requestId = ++versionRequest.current;
    setQuote(null);
    setError(undefined);
    setShareOpen(false);
    setContractSource(null);
    handledShare.current = false;
    if (quotationId !== null)
      void getQuotation(quotationId)
        .then((row) => {
          if (!cancelled && requestId === versionRequest.current) {
            setQuote(row);
          }
        })
        .catch((err) => {
          if (!cancelled)
            setError(err instanceof Error ? err.message : '报价加载失败');
        });
    return () => {
      cancelled = true;
    };
  }, [quotationId]);
  const currentVersion = quote?.currentVersion ?? (quote?.versions?.length
    ? Math.max(...quote.versions.map((version) => version.version))
    : quote?.version);
  const versionRows = quote?.versions
    ? [...quote.versions].sort((a, b) => a.version - b.version)
    : [];
  const versionIndex = quote
    ? versionRows.findIndex((version) => version.id === quote.id)
    : -1;
  const previousVersion = versionIndex > 0 ? versionRows[versionIndex - 1] : undefined;
  const nextVersion = versionIndex >= 0 && versionIndex < versionRows.length - 1
    ? versionRows[versionIndex + 1]
    : undefined;
  const isCurrent = Boolean(
    quote &&
      quote.version === currentVersion,
  );
  const selectVersion = (id: number) => {
    if (id === quote?.id) return;
    const requestId = ++versionRequest.current;
    setError(undefined);
    void getQuotation(id)
      .then((next) => {
        if (requestId === versionRequest.current) setQuote(next);
      })
      .catch((err) => {
        if (requestId === versionRequest.current)
          setError(err instanceof Error ? err.message : '报价加载失败');
      });
  };
  useEffect(() => {
    if (!quote) return;
    let cancelled = false;
    const refreshOnFocus = () => {
      const requestId = ++versionRequest.current;
      void getQuotation(quote.id)
        .then((updated) => {
          if (!cancelled && requestId === versionRequest.current) {
            setError(undefined);
            setQuote(updated);
            if (quote.share?.id !== updated.share?.id) {
              window.dispatchEvent(new CustomEvent(QUOTATION_CHANGED_EVENT, {
                detail: { customerId: updated.customerId },
              }));
            }
          }
        })
        .catch(() => {
          if (!cancelled) setError('报价状态刷新失败，请重新打开报价');
        });
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [quote]);
  const openShareModal = () => {
    if (!quote) return;
    setExpiryChoice(quote.validUntil ? 'follow' : 7);
    setCustomDate(undefined);
    setShareOpen(true);
  };
  const expiryDate =
    expiryChoice === 'follow'
      ? quote?.validUntil
      : expiryChoice === 'custom'
        ? customDate
        : dayjs().add(expiryChoice, 'day').format('YYYY-MM-DD');
  const shareExpired = Boolean(
    quote?.share && dayjs(quote.share.expiresAt).isBefore(dayjs()),
  );
  const shareActive = Boolean(
    quote?.share?.status === 'active' && !shareExpired,
  );
  const shareUrl = quote?.share?.url
    ? new URL(quote.share.url, window.location.origin).toString()
    : undefined;
  const canShare = Boolean(
    quote &&
      isCurrent &&
      (quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted') &&
      can('crm:quotation:send'),
  );
  const generateShare = async () => {
    if (!quote || submitting.current) return;
    if (!expiryDate || dayjs(expiryDate).endOf('day').isBefore(dayjs())) {
      notice.error('分享有效期必须晚于当前时间');
      return;
    }
    submitting.current = true;
    setSending(true);
    try {
      const result = await createQuotationShare(quote.id, {
        followQuoteValidUntil: expiryChoice === 'follow',
        replaceShareId: quote.share?.id,
        ...(typeof expiryChoice === 'number'
          ? { durationDays: expiryChoice }
          : {}),
        ...(expiryChoice === 'custom' ? { customDate } : {}),
      });
      setQuote({
        ...quote,
        share: {
          id: result.shareId,
          url: result.url,
          status: 'active',
          expiresAt: result.expiresAt,
          sentAt: null,
          firstViewedAt: null,
          lastViewedAt: null,
          viewCount: 0,
        },
      });
      setShareOpen(false);
      notice.success('分享链接已生成');
      window.dispatchEvent(
        new CustomEvent(QUOTATION_CHANGED_EVENT, {
          detail: { customerId: quote.customerId },
        }),
      );
      try {
        await onChanged?.();
      } catch {
        notice.warning('分享链接已生成，请刷新列表');
      }
    } catch (err) {
      notice.error(err instanceof Error ? err.message : '生成分享链接失败');
      try {
        setQuote(await getQuotation(quote.id));
      } catch {
        setError('分享状态刷新失败，请重新打开报价');
      }
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      notice.success('链接已复制');
    } catch (err) {
      notice.error(err instanceof Error ? err.message : '链接复制失败');
    }
  };
  const send = async () => {
    if (!quote?.share || submitting.current) return;
    submitting.current = true;
    setSending(true);
    try {
      const sent = await sendQuotation(quote.id, quote.share.id);
      setQuote(sent);
      notice.success('报价已发送');
      window.dispatchEvent(
        new CustomEvent(QUOTATION_CHANGED_EVENT, {
          detail: { customerId: quote.customerId },
        }),
      );
      window.dispatchEvent(new Event(OPPORTUNITY_CHANGED_EVENT));
      try {
        await onChanged?.();
      } catch {
        notice.warning('报价已发送，关联信息刷新失败');
      }
      onClose();
    } catch (err) {
      notice.error(err instanceof Error ? err.message : '发送失败');
      throw err;
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };
  const confirmSend = async () => {
    if (!shareActive) {
      notice.info('请先生成有效的分享链接');
      openShareModal();
      return;
    }
    await modal.confirm({
      title: '确认发送报价？',
      content: '发送后报价将标记为已发送。',
      okText: '确认发送',
      cancelText: '取消',
      zIndex: CRM_DIALOG_Z_INDEX + 30,
      onOk: send,
    });
  };
  const revokeCurrentShare = async () => {
    if (!quote?.share) return;
    try {
      await revokeQuotationShare(quote.id, quote.share.id);
      setQuote({ ...quote, share: { ...quote.share, status: 'revoked' } });
      notice.success('分享链接已停用');
    } catch (err) {
      notice.error(err instanceof Error ? err.message : '停用失败');
      throw err;
    }
  };
  const status = quote ? statusOf(quote.status, QUOTATION_STATUSES) : null;
  const actions = quote && isCurrent ? getQuoteActions(quote, can) : null;
  const refreshDetail = async () => {
    if (quote) setQuote(await getQuotation(quote.id));
    await onChanged?.();
  };
  const confirmQuote = () => {
    if (!quote) return;
    const selected = quote;
    modal.confirm({
      title: '确认报价',
      content: <>
        <Typography.Paragraph>确认客户已接受当前 V{selected.version} 报价？</Typography.Paragraph>
        <Typography.Paragraph>报价金额：{formatQuoteMoney(selected.totalCents)}</Typography.Paragraph>
        <Typography.Paragraph>确认后当前版本将锁定，并可继续生成合同。</Typography.Paragraph>
      </>,
      okText: '确认报价', cancelText: '取消', zIndex: CRM_DIALOG_Z_INDEX + 30,
      onOk: async () => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          const updated = await confirmQuotation(selected.id);
          setQuote({ ...selected, ...updated });
          notice.success('报价已确认');
          window.dispatchEvent(new CustomEvent(QUOTATION_CHANGED_EVENT, { detail: { customerId: selected.customerId } }));
          try {
            setQuote(await getQuotation(selected.id));
            await onChanged?.();
          } catch { notice.warning('报价已确认，请刷新列表'); }
        } catch (err) {
          notice.error(err instanceof Error ? err.message : '确认报价失败');
          throw err;
        } finally { submitting.current = false; }
      },
    });
  };
  const openContract = async () => {
    if (!quote) return;
    try {
      const current = await getQuotation(quote.id);
      setQuote(current);
      if (current.contractId) { notice.info('当前报价已生成合同'); return; }
      if (current.status !== 'accepted' || current.version !== (current.currentVersion ?? current.version)) {
        notice.warning('只有当前已确认报价可以生成合同'); return;
      }
      setContractSource(current);
    } catch (err) { notice.error(err instanceof Error ? err.message : '报价加载失败'); }
  };
  const previewUrl = `/q/preview?preview=1&quotationId=${quote?.id}`;
  useEffect(() => {
    if (!quote || initialAction !== 'generate' || handledShare.current) return;
    handledShare.current = true;
    shareSection.current?.scrollIntoView?.({ block: 'nearest' });
    if (!shareActive && canShare) openShareModal();
  }, [quote, initialAction]);
  return (
    <>
      {noticeHolder}
      <Modal
        open={quotationId !== null}
        width="min(960px, calc(100vw - 32px))"
        zIndex={CRM_DIALOG_Z_INDEX + 20}
        destroyOnHidden
        onCancel={onClose}
        title={
          quote ? (
            <Flex justify="space-between" align="flex-start" gap={16} style={{ paddingRight: 32 }}>
              <Flex vertical gap={4} style={{ minWidth: 0 }}>
                <Space wrap>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {quote.seriesTitle ?? quote.name}
                  </Typography.Text>
                  <Tag>V{quote.version}</Tag>
                  <Tag color={status?.semantic}>{status?.label}</Tag>
                </Space>
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 13, fontWeight: 400 }}
                >
                  {quote.seriesNo ?? quote.quotationNo} · {quote.opportunityName}
                  {quote.opportunityNo ? ` · ${quote.opportunityNo}` : ''}
                </Typography.Text>
              </Flex>
              <Flex gap={4} align="center" style={{ flex: 'none' }}>
                <Button
                  type="link"
                  size="small"
                  disabled={!previousVersion}
                  onClick={() => previousVersion && selectVersion(previousVersion.id)}
                >
                  上一版
                </Button>
                <Button
                  type="link"
                  size="small"
                  disabled={!nextVersion}
                  onClick={() => nextVersion && selectVersion(nextVersion.id)}
                >
                  下一版
                </Button>
                {isCurrent && <QuoteActions
                  quote={quote}
                  menuOnly
                  onChanged={refreshDetail}
                  onDeleted={onClose}
                />}
              </Flex>
            </Flex>
          ) : (
            '报价详情'
          )
        }
        footer={
          <Space>
            <Button onClick={onClose}>关闭</Button>
            {quote && isCurrent && actions?.canEdit && (
              <QuoteFormModal
                quotationId={quote.id}
                customerId={quote.customerId}
                customerName={quote.customerName ?? ''}
                onChanged={refreshDetail}
                renderTrigger={(open) => <Button onClick={open}>编辑</Button>}
              />
            )}
            {quote && isCurrent && quote.status === 'draft' && quote.share && actions?.canShare && (
              <Button type="primary" loading={sending} onClick={() => void confirmSend()}>
                发送报价
              </Button>
            )}
            {actions?.canConfirm && <Button type="primary" onClick={confirmQuote}>确认报价</Button>}
            {actions?.canCreateContract && <Button type="primary" onClick={() => void openContract()}>生成合同</Button>}
          </Space>
        }
      >
        {error ? (
          <Alert type="error" title={error} />
        ) : !quote ? (
          <Spin />
        ) : (
          <>
            <Flex wrap gap={48} style={{ margin: '24px 0' }}>
              {[
                ['报价金额', formatQuoteMoney(quote.totalCents)],
                [
                  '有效期至',
                  quote.validUntil
                    ? dayjs(quote.validUntil).format('YYYY-MM-DD')
                    : '—',
                ],
                ['负责人', quote.ownerUserName || '—'],
              ].map(([label, value]) => (
                <Flex vertical key={label} gap={4}>
                  <Typography.Text strong style={{ fontSize: 20 }}>
                    {value}
                  </Typography.Text>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                </Flex>
              ))}
            </Flex>
            <Typography.Title level={5}>报价明细</Typography.Title>
            <Table<QuotationResp['items'][number]>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={quote.items}
              scroll={{ x: 700 }}
              columns={[
                {
                  title: '项目名称',
                  dataIndex: 'productNameSnapshot',
                  width: 180,
                },
                {
                  title: '描述',
                  dataIndex: 'description',
                  render: (value) => value || '—',
                },
                {
                  title: '数量 / 规格',
                  render: (_, item) =>
                    `${item.quantityCents / 10000} ${item.unitSnapshot || ''}`,
                  width: 100,
                },
                {
                  title: '单价',
                  align: 'right',
                  render: (_, item) => formatQuoteMoney(item.unitPriceCents),
                  width: 120,
                },
                {
                  title: '金额',
                  align: 'right',
                  render: (_, item) => formatQuoteMoney(item.lineAmountCents),
                  width: 120,
                },
              ]}
            />
            <Flex
              vertical
              gap={12}
              style={{
                width: 320,
                maxWidth: '100%',
                margin: '24px 0 24px auto',
              }}
            >
              <Flex justify="space-between">
                <Typography.Text type="secondary">小计</Typography.Text>
                <Typography.Text>
                  {formatQuoteMoney(
                    (quote.netCents ?? 0) + (quote.taxCents ?? 0),
                  )}
                </Typography.Text>
              </Flex>
              {quote.discountAmountCents > 0 && (
                <Flex justify="space-between" gap={16}>
                  <Typography.Text>
                    {quote.publicDiscountDescription || '优惠'}
                  </Typography.Text>
                  <Typography.Text
                    style={{ flex: 'none', whiteSpace: 'nowrap' }}
                  >
                    -{formatQuoteMoney(quote.discountAmountCents)}
                  </Typography.Text>
                </Flex>
              )}
              <Divider style={{ margin: 0 }} />
              <Flex justify="space-between" align="center">
                <Typography.Text strong>报价金额</Typography.Text>
                <Typography.Text strong style={{ fontSize: 20 }}>
                  {formatQuoteMoney(quote.totalCents)}
                </Typography.Text>
              </Flex>
            </Flex>
            <Divider />
            <Typography.Title level={5}>分享</Typography.Title>
            <Flex
              ref={shareSection}
              justify="space-between"
              align="flex-start"
              gap={24}
              wrap
              style={{ marginBottom: 24 }}
            >
              <Flex vertical gap={8} style={{ flex: '1 1 360px', minWidth: 0 }}>
                {!quote.share ? (
                  <>
                    <Typography.Text>尚未生成客户分享链接</Typography.Text>
                    <Typography.Text type="secondary">
                      客户无需登录即可查看，默认有效期7天。
                    </Typography.Text>
                  </>
                ) : (
                  <>
                    <Space wrap>
                      {quote.share.status === 'revoked' ? (
                        <Tag>已停用</Tag>
                      ) : shareExpired ? (
                        <Tag color="warning">已过期</Tag>
                      ) : null}
                      <Typography.Text>
                        有效至{' '}
                        {dayjs(quote.share.expiresAt).format(
                          'YYYY-MM-DD HH:mm',
                        )}
                      </Typography.Text>
                    </Space>
                    <Tooltip
                      title={
                        quote.share.firstViewedAt
                          ? '首次查看 ' +
                            dayjs(quote.share.firstViewedAt).format(
                              'YYYY-MM-DD HH:mm',
                            )
                          : undefined
                      }
                    >
                      <Typography.Text type="secondary">
                        {quote.share.firstViewedAt
                          ? '客户已查看' +
                            (quote.share.lastViewedAt
                              ? ' · 最近 ' +
                                dayjs(quote.share.lastViewedAt).format(
                                  'MM-DD HH:mm',
                                )
                              : '') +
                            ' · 共' +
                            quote.share.viewCount +
                            '次'
                          : '客户未查看'}
                      </Typography.Text>
                    </Tooltip>
                  </>
                )}
              </Flex>
              <Space>
                {quote.share ? (
                  <>
                    <Button
                      aria-label="复制"
                      disabled={!shareActive || !shareUrl}
                      onClick={() => void copyLink()}
                    >
                      复制
                    </Button>
                    <Button
                      aria-label="预览"
                      disabled={!can('crm:quotation:list')}
                      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      预览
                    </Button>
                    {canShare && (
                      <Dropdown
                        menu={{
                          items: [
                            { key: 'regenerate', label: '重新生成' },
                            {
                              key: 'revoke',
                              label: '停用',
                              danger: true,
                              disabled: quote.share.status === 'revoked',
                            },
                          ],
                          onClick: async ({ key }) => {
                            if (key === 'regenerate')
                              await modal.confirm({
                                title: '重新生成分享链接？',
                                content: '生成新链接后，当前链接将停止访问。',
                                okText: '重新生成',
                                cancelText: '取消',
                                zIndex: CRM_DIALOG_Z_INDEX + 30,
                                onOk: openShareModal,
                              });
                            else
                              await modal.confirm({
                                title: '停用分享链接？',
                                content:
                                  '停用后客户将无法继续通过当前链接查看报价。',
                                okText: '停用',
                                okButtonProps: { danger: true },
                                cancelText: '取消',
                                zIndex: CRM_DIALOG_Z_INDEX + 30,
                                onOk: revokeCurrentShare,
                              });
                          },
                        }}
                        trigger={['hover', 'click']}
                        placement="bottomRight"
                      >
                        <Button
                          aria-label="更多分享操作"
                        >
                          更多
                        </Button>
                      </Dropdown>
                    )}
                  </>
                ) : (
                  <>
                  {canShare && (
                    <Button type="primary" onClick={openShareModal}>
                      生成
                    </Button>
                  )}
                  <Button
                    aria-label="预览"
                    disabled={!can('crm:quotation:list')}
                    onClick={() =>
                      window.open(previewUrl, '_blank', 'noopener,noreferrer')
                    }
                  >
                    预览
                  </Button>
                  </>
                )}
              </Space>
            </Flex>
            <Typography.Title level={5}>备注</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {quote.remark || '—'}
            </Typography.Paragraph>
            {quote.discountAmountCents > 0 && quote.internalDiscountReason && (
              <>
                <Typography.Text type="secondary">内部优惠原因</Typography.Text>
                <Typography.Paragraph
                  style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}
                >
                  {quote.internalDiscountReason}
                </Typography.Paragraph>
              </>
            )}
            <Typography.Text type="secondary">
              报价日期：
              {quote.quoteDate
                ? dayjs(quote.quoteDate).format('YYYY-MM-DD')
                : '—'}{' '}
              · 创建时间：{dayjs(quote.createdAt).format('YYYY-MM-DD HH:mm')}
            </Typography.Text>
            {quote.versions && quote.versions.length > 0 && (
              <>
                <Divider />
                <Typography.Title level={5}>版本记录</Typography.Title>
                <Table<{
                  id: number;
                  version: number;
                  status: string;
                  totalCents: number;
                  quoteDate: string | null;
                  shareFirstViewedAt?: string | null;
                  shareViewCount?: number;
                }>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={[...quote.versions].sort((a, b) => b.version - a.version)}
                  columns={[
                    {
                      title: '版本',
                      render: (_: unknown, version: { id: number; version: number }) => (
                        <Typography.Link onClick={() => selectVersion(version.id)}>
                          V{version.version}
                        </Typography.Link>
                      ),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (value: string) => statusOf(value, QUOTATION_STATUSES)?.label ?? value,
                    },
                    {
                      title: '金额',
                      dataIndex: 'totalCents',
                      align: 'right' as const,
                      render: (value: number) => formatQuoteMoney(value),
                    },
                    {
                      title: '日期',
                      dataIndex: 'quoteDate',
                      render: (value: string | null) => value ? dayjs(value).format('MM-DD') : '—',
                    },
                    {
                      title: '客户查看',
                      render: (_: unknown, version: { shareFirstViewedAt?: string | null; shareViewCount?: number }) =>
                        version.shareFirstViewedAt ? `已查看${version.shareViewCount ? ` · 共${version.shareViewCount}次` : ''}` : '未查看',
                    },
                    {
                      title: ' ',
                      render: (_: unknown, version: { id: number; version: number }) => version.version === currentVersion ? <Typography.Text type="secondary">当前</Typography.Text> : null,
                    },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>
      {contractSource && <ContractCreateModal
        open={true}
        onOpenChange={open => { if (!open) setContractSource(null); }}
        customerId={contractSource.customerId} customerName={contractSource.customerName ?? ''}
        existingContacts={[]} existingOpportunities={[]} existingQuotations={[]}
        sourceQuotation={contractSource}
        zIndex={CRM_DIALOG_Z_INDEX + 30}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent(QUOTATION_CHANGED_EVENT, { detail: { customerId: contractSource.customerId } }));
          void refreshDetail().catch(() => notice.warning('合同已创建，请刷新报价'));
        }}
      />}
      <Modal
        open={shareOpen}
        width={560}
        title="生成分享链接"
        zIndex={CRM_DIALOG_Z_INDEX + 30}
        destroyOnHidden
        mask={{ closable: false }}
        closable={!sending}
        onCancel={() => {
          if (!sending) setShareOpen(false);
        }}
        footer={[
          <Button
            key="cancel"
            disabled={sending}
            onClick={() => setShareOpen(false)}
          >
            取消
          </Button>,
          <Button
            key="generate"
            type="primary"
            loading={sending}
            onClick={() => void generateShare()}
          >
            生成链接
          </Button>,
        ]}
      >
        {quote && (
          <Flex vertical gap={16}>
            <Flex vertical gap={4}>
              <Typography.Text strong>{quote.name}</Typography.Text>
              <Typography.Text>
                {formatQuoteMoney(quote.totalCents)}
              </Typography.Text>
            </Flex>
            <Flex vertical gap={8}>
              <Typography.Text>有效期</Typography.Text>
              <Select
                aria-label="分享有效期"
                value={expiryChoice}
                onChange={setExpiryChoice}
                options={[
                  ...(quote.validUntil
                    ? [
                        {
                          value: 'follow',
                          label:
                            '跟随报价有效期（' +
                            dayjs(quote.validUntil).format('YYYY-MM-DD') +
                            '）',
                        },
                      ]
                    : []),
                  ...[3, 7, 14, 30].map((days) => ({
                    value: days,
                    label: `${days}天`,
                  })),
                  { value: 'custom', label: '自定义' },
                ]}
              />
              {expiryChoice === 'custom' && (
                <DatePicker
                  aria-label="自定义有效期"
                  value={customDate ? dayjs(customDate) : null}
                  onChange={(value) =>
                    setCustomDate(value?.format('YYYY-MM-DD'))
                  }
                />
              )}
              {expiryDate && (
                <Typography.Text type="secondary">
                  有效至 {dayjs(expiryDate).format('YYYY-MM-DD')} 23:59
                </Typography.Text>
              )}
            </Flex>
            <Typography.Text type="secondary">
              客户无需登录即可查看，到期后链接自动失效。
            </Typography.Text>
          </Flex>
        )}
      </Modal>
      {contextHolder}
    </>
  );
}
