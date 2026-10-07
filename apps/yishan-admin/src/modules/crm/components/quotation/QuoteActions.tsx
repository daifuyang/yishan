import { Button, Dropdown, Flex, Modal, message } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import {
  deleteQuotation,
  getQuotation,
  type QuotationRow,
  type QuoteSeriesSummary,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import { getQuoteActions } from '../../domain/quoteActions';
import { QUOTATION_CHANGED_EVENT } from '../../utils/crmEvents';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';
import QuoteFormModal from './QuoteFormModal';
import QuoteVoidModal from './QuoteVoidModal';
import QuoteReviseAction from './QuoteReviseAction';
import QuoteRevokeConfirmationModal from './QuoteRevokeConfirmationModal';

export default function QuoteActions({
  quote,
  onDetail,
  onGenerate,
  onChanged,
  onDeleted,
  menuOnly = false,
}: {
  quote: QuotationRow | QuoteSeriesSummary;
  onDetail?: () => void;
  onGenerate?: () => void;
  onChanged: () => void | Promise<void>;
  onDeleted?: () => void;
  menuOnly?: boolean;
}) {
  const can = usePermission();
  const normalized: QuotationRow =
    'title' in quote
      ? ({
          ...quote,
          id: quote.currentQuoteId ?? 0,
          status: quote.currentStatus ?? 'draft',
          customerName: quote.customerName,
          hasShare: 'hasShare' in quote ? quote.hasShare : quote.hasActiveShare,
          share: quote.hasActiveShare ? { status: 'active' } : null,
        } as unknown as QuotationRow)
      : (quote as QuotationRow);
  const actions = getQuoteActions(normalized, can);
  const [modal, modalHolder] = Modal.useModal();
  const [notice, noticeHolder] = message.useMessage();
  const [copying, setCopying] = useState(false);
  const copyingLink = useRef(false);
  const shareExists =
    'title' in quote ? quote.hasActiveShare : normalized.hasShare;
  const copyShare = async () => {
    if (copyingLink.current) return;
    copyingLink.current = true;
    setCopying(true);
    try {
      const detail = await getQuotation(normalized.id);
      const share = detail.share;
      if (
        !share?.url ||
        share.status !== 'active' ||
        !dayjs(share.expiresAt).isAfter(dayjs())
      ) {
        notice.warning('分享链接已失效，请在详情中重新生成');
        return;
      }
      await navigator.clipboard.writeText(
        new URL(share.url, window.location.origin).toString(),
      );
      notice.success('链接已复制');
    } catch (error) {
      notice.error(error instanceof Error ? error.message : '链接复制失败');
    } finally {
      copyingLink.current = false;
      setCopying(false);
    }
  };
  const changed = async () => {
    window.dispatchEvent(
      new CustomEvent(QUOTATION_CHANGED_EVENT, {
        detail: { customerId: quote.customerId },
      }),
    );
    await onChanged();
  };
  const remove = () =>
    modal.confirm({
      title: '删除报价？',
      content: '删除后该草稿将不再显示。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      zIndex: CRM_DIALOG_Z_INDEX + 30,
      onOk: async () => {
        try {
          await deleteQuotation(normalized.id);
        } catch (error) {
          notice.error(error instanceof Error ? error.message : '报价删除失败');
          throw error;
        }
        notice.success('报价已删除');
        window.dispatchEvent(
          new CustomEvent(QUOTATION_CHANGED_EVENT, {
            detail: { customerId: quote.customerId },
          }),
        );
        if (onDeleted) onDeleted();
        else
          try {
            await onChanged();
          } catch {
            notice.warning('报价已删除，请刷新列表');
          }
      },
    });
  const hasMenu =
    (!menuOnly && actions.canEdit) ||
    actions.canVoid ||
    actions.canDelete ||
    (menuOnly && actions.canRevokeConfirmation) ||
    (actions.canCreateVersion && (menuOnly || normalized.status === 'sent' || normalized.status === 'accepted'));
  const directVersion =
    !menuOnly && actions.canCreateVersion && normalized.status === 'voided';
  if (
    !onDetail &&
    !actions.canEdit &&
    !actions.canShare &&
    !hasMenu &&
    !directVersion
  )
    return menuOnly ? null : <span>—</span>;
  return (
    <>
      {noticeHolder}
      {modalHolder}
      <Flex gap={8} align="center">
        {!menuOnly && onDetail && can('crm:quotation:list') && (
          <TypographyAction onClick={onDetail}>详情</TypographyAction>
        )}
        {!menuOnly &&
          actions.canShare &&
          (shareExists ? (
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 0 }}
              loading={copying}
              onClick={() => void copyShare()}
            >
              分享
            </Button>
          ) : (
            <TypographyAction onClick={onGenerate}>生成</TypographyAction>
          ))}
        {directVersion && (
          <QuoteReviseAction
            quote={normalized}
            onChanged={onChanged}
            renderTrigger={(revise, loading) => (
              <Button
                type="link"
                size="small"
                style={{ paddingInline: 0 }}
                loading={loading}
                onClick={revise}
              >
                新版本
              </Button>
            )}
          />
        )}
        {hasMenu && (
          <QuoteReviseAction
            quote={normalized}
            onChanged={onChanged}
            renderTrigger={(revise, revising) => (
              <QuoteVoidModal
                quotationId={normalized.id}
                onChanged={changed}
                renderTrigger={(openVoid) => (
                  <QuoteFormModal
                    quotationId={normalized.id}
                    customerId={quote.customerId}
                    customerName={quote.customerName ?? ''}
                    onChanged={onChanged}
                    renderTrigger={(openEdit) => (
                      <QuoteRevokeConfirmationModal quotationId={normalized.id} onChanged={changed} renderTrigger={openRevoke => (
                      <Dropdown
                        trigger={['hover', 'click']}
                        placement="bottomRight"
                        menu={{
                          items: [
                            ...(!menuOnly && actions.canEdit
                              ? [{ key: 'edit', label: '编辑' }]
                              : []),
                            ...(actions.canCreateVersion &&
                            (menuOnly || normalized.status === 'sent' || normalized.status === 'accepted')
                              ? [
                                  {
                                    key: 'revise',
                                    label: '新版本',
                                    disabled: revising,
                                  },
                                ]
                              : []),
                            ...(menuOnly && actions.canRevokeConfirmation ? [{ key: 'revoke-confirmation', label: '撤销确认', danger: true }] : []),
                            ...(actions.canVoid
                              ? [{ key: 'void', label: '作废', danger: true }]
                              : []),
                            ...(actions.canDelete
                              ? [{ key: 'delete', label: '删除', danger: true }]
                              : []),
                          ],
                          onClick: ({ key }) => {
                            if (key === 'edit') openEdit();
                            else if (key === 'revise') revise();
                            else if (key === 'void') openVoid();
                            else if (key === 'revoke-confirmation') openRevoke();
                            else void remove();
                          },
                        }}
                      >
                        <Button
                          type="link"
                          size="small"
                          style={{ paddingInline: 0 }}
                          aria-label="更多报价操作"
                          loading={revising}
                        >
                          更多
                        </Button>
                      </Dropdown>
                      )} />
                    )}
                  />
                )}
              />
            )}
          />
        )}
      </Flex>
    </>
  );
}

function TypographyAction({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: string;
}) {
  return (
    <Button
      type="link"
      size="small"
      style={{ paddingInline: 0 }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
