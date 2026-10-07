import { Button, Modal, message } from 'antd';
import React, { useRef } from 'react';
import { advanceOpportunityStage, type OpportunityRow } from '@/services/crm';
import { usePermission } from '@/utils/permission';
import {
  opportunityStageActions,
  opportunityStageConfig,
} from '../../domain/statuses';
import { OPPORTUNITY_CHANGED_EVENT } from '../../utils/crmEvents';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';
import QuoteCreateModal from '../quotation/QuoteCreateModal';

export { OPPORTUNITY_CHANGED_EVENT } from '../../utils/crmEvents';

export default function OpportunityAdvanceModal({
  opportunity,
  onRefresh,
  compact = false,
}: {
  opportunity: OpportunityRow;
  onRefresh: (updated?: OpportunityRow) => void | Promise<void>;
  compact?: boolean;
}) {
  const can = usePermission();
  const [notice, noticeHolder] = message.useMessage();
  const [modal, contextHolder] = Modal.useModal();
  const submitting = useRef(false);
  const action = opportunityStageActions[opportunity.stage];
  const showAdvance =
    opportunity.stage !== 'solution' &&
    Boolean(action) &&
    can('crm:opportunity:stage');
  const confirm = async () => {
    if (!action) return;
    let updated: OpportunityRow | undefined;
    const confirmation = modal.confirm({
      title: `确认执行“${action.label}”？`,
      content:
        `当前阶段：${opportunityStageConfig[opportunity.stage].label}。` +
        (action.next === 'negotiation'
          ? '后续可跟进价格、付款方式及合同条款的协商。'
          : ''),
      okText: '确认',
      cancelText: '取消',
      zIndex: CRM_DIALOG_Z_INDEX + 10,
      onOk: async () => {
        if (submitting.current) return;
        submitting.current = true;
        confirmation.update({
          cancelButtonProps: { disabled: true },
          keyboard: false,
        });
        try {
          updated = await advanceOpportunityStage(opportunity.id, {
            toStage: action.next,
          });
        } catch (error) {
          confirmation.update({
            cancelButtonProps: { disabled: false },
            keyboard: true,
          });
          notice.error(
            error instanceof Error ? error.message : '阶段推进失败，请重试',
          );
          throw error;
        } finally {
          submitting.current = false;
        }
      },
    });
    const confirmed = await confirmation;
    if (!confirmed || !updated) return;
    notice.success(`${action.label}已完成`);
    window.dispatchEvent(new Event(OPPORTUNITY_CHANGED_EVENT));
    try {
      await onRefresh(updated);
    } catch {
      notice.error('阶段已更新，刷新失败，请重新打开商机');
    }
  };
  return (
    <>
      {noticeHolder}
      <QuoteCreateModal
        opportunity={opportunity}
        onChanged={() => onRefresh()}
        renderTrigger={
          opportunity.stage === 'solution'
            ? (openQuoteCreateModal) => (
                <Button
                  type={compact ? 'link' : 'primary'}
                  size={compact ? 'small' : 'middle'}
                  onClick={openQuoteCreateModal}
                >
                  报价
                </Button>
              )
            : undefined
        }
      />
      {showAdvance && (
        <Button
          type={compact ? 'link' : 'primary'}
          size={compact ? 'small' : 'middle'}
          onClick={confirm}
        >
          {action?.label}
        </Button>
      )}
      {contextHolder}
    </>
  );
}
