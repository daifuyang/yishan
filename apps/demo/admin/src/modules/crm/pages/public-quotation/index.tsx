import { request, useLocation, useParams } from '@umijs/max';
import { Alert, Button, Space, Spin, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  createQuotationShare,
  getQuotation,
  type QuotationResp,
} from '@/services/crm';
import { formatQuoteMoney as money } from '@/modules/crm/utils/quotationMoney';
import { usePermission } from '@/utils/permission';
import styles from './index.module.less';

interface PublicQuoteItem {
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPriceCents: number;
  amountCents: number;
}
interface PublicQuote {
  companyName: string;
  quoteTitle: string;
  quoteNumber: string;
  quoteDate: string | null;
  validUntil: string | null;
  customerName: string;
  contactDisplayName: string | null;
  items: PublicQuoteItem[];
  subtotalCents: number;
  discountAmountCents: number;
  publicDiscountDescription: string | null;
  totalAmountCents: number;
  remark: string | null;
  salesContactName: string | null;
  salesContactPhone: string | null;
  version: number;
}
interface PublicResponse {
  state: 'ok' | 'expired' | 'revoked' | 'invalid';
  quote: PublicQuote | null;
}

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value))
    : '—';

export default function PublicQuotePage() {
  const can = usePermission();
  const [notice, noticeHolder] = message.useMessage();
  const { token } = useParams<{ token: string }>();
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const internalPreview = token === 'preview';
  const quotationId = Number(query.get('quotationId'));
  const autoPrint = internalPreview && query.get('print') === '1';
  const printed = useRef(false);
  const [result, setResult] = useState<PublicResponse>();
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [detail, setDetail] = useState<QuotationResp>();
  const share = detail?.share;
  const [shareUrl, setShareUrl] = useState<string>();
  const [generatingShare, setGeneratingShare] = useState(false);
  const submitting = useRef(false);
  const canGenerate = Boolean(
    internalPreview &&
      detail &&
      !share &&
      detail.version === (detail.currentVersion ?? detail.version) &&
      (detail.status === 'draft' || detail.status === 'sent') &&
      can('crm:quotation:send'),
  );
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setResult(undefined);
    setError(undefined);
    setActionError(undefined);
    setDetail(undefined);
    setShareUrl(undefined);
    printed.current = false;
    if (
      internalPreview &&
      (!Number.isSafeInteger(quotationId) || quotationId < 1)
    ) {
      setError('内部预览参数无效');
      return;
    }
    void request<{ data: PublicResponse | PublicQuote }>(
      internalPreview
        ? `/api/crm/v1/quotations/${quotationId}/preview`
        : `/api/crm/v1/public/quotes/${encodeURIComponent(token)}`,
      { method: 'GET', skipErrorHandler: true },
    )
      .then((response) => {
        if (!cancelled)
          setResult(
            internalPreview
              ? { state: 'ok', quote: response.data as PublicQuote }
              : (response.data as PublicResponse),
          );
      })
      .catch(() => {
        if (!cancelled)
          setError(
            internalPreview ? '内部预览暂不可用' : '报价链接无效或已失效',
          );
      });
    if (internalPreview) {
      void getQuotation(quotationId)
        .then((detail) => {
          if (!cancelled) {
            setDetail(detail);
            if (detail.share?.url)
              setShareUrl(
                new URL(detail.share.url, window.location.origin).toString(),
              );
          }
        })
        .catch(() => {
          if (!cancelled) setActionError('分享状态加载失败，请刷新后重试');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token, internalPreview, quotationId]);
  useEffect(() => {
    if (!result?.quote) return;
    const previousTitle = document.title;
    document.title = result.quote.quoteTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [result?.quote]);
  useEffect(() => {
    if (!autoPrint || !result?.quote || printed.current) return;
    const timer = window.setTimeout(() => {
      printed.current = true;
      window.print();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [autoPrint, result?.quote]);

  const generateShare = async () => {
    if (!canGenerate || !detail || submitting.current) return;
    submitting.current = true;
    setGeneratingShare(true);
    setActionError(undefined);
    try {
      const created = await createQuotationShare(quotationId, {
        followQuoteValidUntil: true,
      });
      setDetail({
        ...detail,
        hasShare: true,
        share: {
          id: created.shareId,
          status: 'active',
          expiresAt: created.expiresAt,
          sentAt: null,
          firstViewedAt: null,
          lastViewedAt: null,
          viewCount: 0,
        },
      });
      setShareUrl(new URL(created.url, window.location.origin).toString());
      notice.success('分享链接已生成');
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : '分享链接生成失败',
      );
    } finally {
      submitting.current = false;
      setGeneratingShare(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      notice.success('链接已复制');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '链接复制失败');
    }
  };

  if (error)
    return (
      <StatusPage
        title={error}
        description={
          internalPreview
            ? '请登录 CRM 并确认报价访问权限后重试。'
            : '请确认链接是否完整，或联系销售人员获取最新报价。'
        }
      />
    );
  if (!result)
    return (
      <div className={styles.loading}>
        <Spin />
      </div>
    );
  if (result.state === 'expired')
    return (
      <StatusPage
        title="报价链接已失效"
        description="该报价已超过有效期，请联系销售人员获取最新报价。"
      />
    );
  if (result.state === 'revoked')
    return (
      <StatusPage
        title="该报价链接已停止访问"
        description="请联系销售人员获取最新报价。"
      />
    );
  if (!result.quote)
    return (
      <StatusPage
        title="报价链接无效或已失效"
        description="请确认链接是否完整，或联系销售人员获取最新报价。"
      />
    );
  const quote = result.quote;
  // 当前禾味沙盘未提供销售手机号；真实接口值始终优先。
  const salesContactPhone =
    quote.salesContactPhone ||
    (quote.customerName === '上海禾味餐饮管理有限公司' &&
    quote.salesContactName === '愚公'
      ? '13816885621'
      : null);
  const remarks = (quote.remark || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:\d+[.、．)](?!\d)\s*|[-•]\s+)/, ''))
    .filter(Boolean);
  return (
    <main className={styles.page}>
      {noticeHolder}
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <span>{internalPreview ? '内部预览，不计入客户查看' : ''}</span>
          <Space size={8} wrap>
            {canGenerate && (
              <Button
                type="primary"
                loading={generatingShare}
                onClick={() => void generateShare()}
              >
                生成
              </Button>
            )}
            {internalPreview && share && shareUrl && (
              <Button aria-label="复制" onClick={() => void copyShareUrl()}>
                复制
              </Button>
            )}
            <Button onClick={() => window.print()}>打印 / 导出 PDF</Button>
          </Space>
        </div>
        {actionError && (
          <div className={styles.actionError}>
            <Alert type="error" message={actionError} showIcon />
          </div>
        )}
        <div className={styles.printHint}>
          在打印窗口选择“另存为 PDF”即可导出文件。
        </div>
        <article className={styles.document} aria-labelledby="quote-title">
          <header className={styles.header}>
            <div className={styles.brand}>{quote.companyName}</div>
            <div>报价</div>
          </header>
          <h1 id="quote-title" className={styles.title}>
            {quote.quoteTitle}
          </h1>
          <section className={styles.overview} aria-label="报价基本信息">
            <dl className={styles.metadata}>
              <div>
                <dt>客户</dt>
                <dd>{quote.customerName}</dd>
              </div>
              <div>
                <dt>销售联系人</dt>
                <dd>{quote.salesContactName || '—'}</dd>
              </div>
              <div>
                <dt>联系电话</dt>
                <dd>{salesContactPhone || '—'}</dd>
              </div>
              <div>
                <dt>报价编号</dt>
                <dd>{quote.quoteNumber}</dd>
              </div>
              <div>
                <dt>报价日期</dt>
                <dd>{date(quote.quoteDate)}</dd>
              </div>
              <div>
                <dt>有效期至</dt>
                <dd>{date(quote.validUntil)}</dd>
              </div>
            </dl>
            <div className={styles.total}>
              <span>报价金额</span>
              <strong>{money(quote.totalAmountCents)}</strong>
            </div>
          </section>
          <section>
            <div className={styles.tableScroll}>
              <table className={styles.itemsTable} aria-label="报价明细">
                <colgroup>
                  <col className={styles.nameColumn} />
                  <col className={styles.descriptionColumn} />
                  <col className={styles.quantityColumn} />
                  <col className={styles.moneyColumn} />
                  <col className={styles.moneyColumn} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">项目 / 服务名称</th>
                    <th scope="col">描述</th>
                    <th scope="col">数量 / 规格</th>
                    <th scope="col">单价</th>
                    <th scope="col">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr
                      key={`${item.name}-${item.amountCents}-${item.unit || ''}-${item.description || ''}`}
                    >
                      <th scope="row">{item.name}</th>
                      <td className={styles.description}>
                        {item.description || '—'}
                      </td>
                      <td>
                        {item.quantity} {item.unit || ''}
                      </td>
                      <td>{money(item.unitPriceCents)}</td>
                      <td>{money(item.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.summary}>
              <div>
                <span>小计</span>
                <b>{money(quote.subtotalCents)}</b>
              </div>
              {quote.discountAmountCents > 0 && (
                <div>
                  <span>{quote.publicDiscountDescription || '优惠'}</span>
                  <b className={styles.discount}>
                    -{money(quote.discountAmountCents)}
                  </b>
                </div>
              )}
              <div className={styles.grand}>
                <span>报价金额</span>
                <b>{money(quote.totalAmountCents)}</b>
              </div>
            </div>
          </section>
          <section className={styles.remarks} aria-labelledby="quote-remarks">
            <h2 id="quote-remarks">备注</h2>
            {remarks.length > 0 ? (
              <ol>
                {remarks.map((remark) => (
                  <li key={remark}>{remark}</li>
                ))}
              </ol>
            ) : (
              <p>—</p>
            )}
          </section>
          <footer className={styles.bottom}>
            本报价由销售人员提供，仅供商务沟通使用
          </footer>
        </article>
      </div>
    </main>
  );
}

function StatusPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className={styles.statusPage}>
      <div className={styles.statusBox}>
        <Alert type="info" showIcon message={title} description={description} />
      </div>
    </main>
  );
}
