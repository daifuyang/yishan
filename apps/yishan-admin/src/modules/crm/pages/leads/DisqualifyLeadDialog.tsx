import { ModalForm, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { message } from 'antd';
import { useState } from 'react';
import { disqualifyLead } from '@/services/crm';
import type { DisqualifyCode, LeadRow } from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../../components/drawer/_shared/crmDialogZIndex';

interface DisqualifyLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadRow | null;
  onUpdated?: (updated: LeadRow) => void;
}

const DISQUALIFY_OPTIONS: Array<{ value: DisqualifyCode; label: string }> = [
  { value: 'duplicate', label: '重复线索' },
  { value: 'not_target', label: '非目标客户' },
  { value: 'no_demand', label: '暂无需求' },
  { value: 'unreachable', label: '无法联系' },
  { value: 'invalid_contact', label: '联系方式错误' },
  { value: 'rejected', label: '明确拒绝' },
  { value: 'other', label: '其他原因' },
]

/**
 * 作废弹窗。
 *
 * 必填：标准化原因 code + 解释。
 * 不提供"自由文本 status 选择器"，杜绝把作废变成任意 status 切换。
 */
export default function DisqualifyLeadDialog({
  open,
  onOpenChange,
  lead,
  onUpdated,
}: DisqualifyLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="作废线索"
      modalProps={{ destroyOnHidden: true, okButtonProps: { loading: submitting, danger: true }, zIndex: CRM_DIALOG_Z_INDEX }}
      initialValues={{ code: 'other' as DisqualifyCode, reason: '' }}
      onFinish={async (values) => {
        if (!lead) return false
        const code = values.code as DisqualifyCode
        const reason = String(values.reason ?? '').trim()
        if (!reason) {
          message.error('请填写作废解释')
          return false
        }
        setSubmitting(true)
        try {
          const updated = await disqualifyLead(lead.id, { code, reason })
          onUpdated?.(updated)
          message.success('线索已作废')
          return true
        } catch (err: any) {
          message.error(err?.message ?? '操作失败')
          return false
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <ProFormSelect
        name="code"
        label="作废原因"
        options={DISQUALIFY_OPTIONS}
        rules={[{ required: true, message: '请选择作废原因' }]}
      />
      <ProFormTextArea
        name="reason"
        label="解释说明"
        placeholder="例如：本周电话联系三次均未接通"
        fieldProps={{ autoSize: { minRows: 3, maxRows: 6 }, maxLength: 500, showCount: true }}
        rules={[{ required: true, whitespace: true, message: '请填写作废解释' }]}
      />
    </ModalForm>
  )
}
