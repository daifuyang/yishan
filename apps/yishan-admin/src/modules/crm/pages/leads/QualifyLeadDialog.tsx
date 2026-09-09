import { ModalForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { message } from 'antd';
import { useState } from 'react';
import { qualifyLead } from '@/services/crm';
import type { LeadRow } from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../../components/drawer/_shared/crmDialogZIndex';

interface QualifyLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadRow | null;
  onUpdated?: (updated: LeadRow) => void;
}

/**
 * 判为有效弹窗。
 *
 * 显式两个必填字段：
 *   - 资格证据：客户已确认的需求/适配证据（不是主观感受）。
 *   - 下一步：与客户约定的下一步销售动作。
 *
 * 提交后调用 crm:lead:qualify，成功时把 lead 替换成后端返回的最新 row。
 */
export default function QualifyLeadDialog({
  open,
  onOpenChange,
  lead,
  onUpdated,
}: QualifyLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="判为有效"
      modalProps={{ destroyOnHidden: true, okButtonProps: { loading: submitting }, zIndex: CRM_DIALOG_Z_INDEX }}
      initialValues={{
        evidence: '',
        nextAction: '',
      }}
      onFinish={async (values) => {
        if (!lead) return false
        const evidence = String(values.evidence ?? '').trim()
        const nextAction = String(values.nextAction ?? '').trim()
        if (!evidence || !nextAction) {
          message.error('请填写资格证据和下一步')
          return false
        }
        setSubmitting(true)
        try {
          const updated = await qualifyLead(lead.id, { evidence, nextAction })
          onUpdated?.(updated)
          message.success('已判为有效')
          return true
        } catch (err: any) {
          message.error(err?.message ?? '操作失败')
          return false
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <ProFormTextArea
        name="evidence"
        label="资格证据"
        placeholder="例如：客户已确认预算 30 万、要求 9 月上线"
        fieldProps={{ autoSize: { minRows: 3, maxRows: 6 }, maxLength: 1000, showCount: true }}
        rules={[{ required: true, whitespace: true, message: '请填写资格证据' }]}
      />
      <ProFormText
        name="nextAction"
        label="下一步"
        placeholder="例如：安排 9 月 15 日线下演示"
        fieldProps={{ maxLength: 500, showCount: true }}
        rules={[{ required: true, whitespace: true, message: '请填写下一步动作' }]}
      />
    </ModalForm>
  )
}
