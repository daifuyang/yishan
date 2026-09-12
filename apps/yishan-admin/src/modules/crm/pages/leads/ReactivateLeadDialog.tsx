import { ModalForm, ProFormTextArea } from '@ant-design/pro-components';
import { Alert, message } from 'antd';
import { useState } from 'react';
import { reactivateLead } from '@/services/crm';
import type { LeadRow } from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../../components/drawer/_shared/crmDialogZIndex';

interface ReactivateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadRow | null;
  onUpdated?: (updated: LeadRow) => void;
}

/**
 * 重新激活弹窗。
 *
 * 仅 disqualified 状态允许；弹窗明确告知用户：激活后线索将回到「跟进中」。
 * 必须填写原因；后端会把原因写入 status_change 审计活动。
 */
export default function ReactivateLeadDialog({
  open,
  onOpenChange,
  lead,
  onUpdated,
}: ReactivateLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="重新激活线索"
      modalProps={{ destroyOnHidden: true, okButtonProps: { loading: submitting }, zIndex: CRM_DIALOG_Z_INDEX }}
      initialValues={{ reason: '' }}
      onFinish={async (values) => {
        if (!lead) return false
        const reason = String(values.reason ?? '').trim()
        if (!reason) {
          message.error('请填写重新激活原因')
          return false
        }
        setSubmitting(true)
        try {
          const updated = await reactivateLead(lead.id, reason)
          onUpdated?.(updated)
          message.success('线索已重新激活，将回到「跟进中」')
          return true
        } catch (err: any) {
          message.error(err?.message ?? '操作失败')
          return false
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <Alert
        type="warning"
        showIcon
        message="重新激活后线索状态将变为「跟进中」，原作废原因与 code 会被清空，并写入一条审计活动。"
        style={{ marginBottom: 16 }}
      />
      <ProFormTextArea
        name="reason"
        label="重新激活原因"
        placeholder="例如：客户已重新接洽并提供新联系方式"
        fieldProps={{ autoSize: { minRows: 3, maxRows: 6 }, maxLength: 500, showCount: true }}
        rules={[{ required: true, whitespace: true, message: '请填写重新激活原因' }]}
      />
    </ModalForm>
  )
}
