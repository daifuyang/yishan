import { message } from 'antd';
import React, { useRef, useState } from 'react';
import { reviseQuotation, type QuotationRow } from '@/services/crm';
import { QUOTATION_CHANGED_EVENT } from '../../utils/crmEvents';
import QuoteFormModal from './QuoteFormModal';

export default function QuoteReviseAction({
  quote,
  onChanged,
  renderTrigger,
}: {
  quote: QuotationRow;
  onChanged?: () => void | Promise<void>;
  renderTrigger: (revise: () => void, loading: boolean) => React.ReactNode;
}) {
  const [notice, noticeHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState<number>();
  const [requestKey, setRequestKey] = useState(0);
  const submitting = useRef(false);
  const refresh = async () => {
    window.dispatchEvent(
      new CustomEvent(QUOTATION_CHANGED_EVENT, {
        detail: { customerId: quote.customerId },
      }),
    );
    try {
      await onChanged?.();
    } catch {
      notice.warning('新版本已创建，请刷新列表');
    }
  };
  const revise = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      const draft = await reviseQuotation(quote.id);
      setDraftId(draft.id);
      setRequestKey((key) => key + 1);
      notice.success(`V${draft.version} 草稿已创建`);
      // 编辑器挂在来源行；关闭后刷新，避免来源被新版本挤出当前分页时编辑器消失。
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '新版本创建失败');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };
  return (
    <>
      {noticeHolder}
      {renderTrigger(() => void revise(), loading)}
      {draftId && (
        <QuoteFormModal
          quotationId={draftId}
          customerId={quote.customerId}
          customerName={quote.customerName ?? ''}
          requestKey={requestKey}
          onClosed={() => void refresh()}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
