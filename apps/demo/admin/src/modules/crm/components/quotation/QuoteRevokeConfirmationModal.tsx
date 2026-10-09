import { ModalForm, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Form, message, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { revokeQuotationConfirmation, type RevokeQuotationConfirmationInput } from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';

export default function QuoteRevokeConfirmationModal({ quotationId, renderTrigger, onChanged }: {
  quotationId: number;
  renderTrigger: (open: () => void) => React.ReactNode;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<RevokeQuotationConfirmationInput>();
  const [notice, holder] = message.useMessage();
  const submitting = useRef(false);
  return <>
    {holder}
    {renderTrigger(() => { form.resetFields(); setOpen(true); })}
    <ModalForm<RevokeQuotationConfirmationInput>
      title="撤销报价确认" width={560} layout="vertical" form={form} open={open} onOpenChange={setOpen}
      modalProps={{ destroyOnHidden: true, mask: { closable: false }, zIndex: CRM_DIALOG_Z_INDEX + 30 }}
      submitter={{ searchConfig: { submitText: '撤销确认', resetText: '取消' }, submitButtonProps: { danger: true } }}
      onFinish={async input => {
        if (submitting.current) return false;
        submitting.current = true;
        try {
          await revokeQuotationConfirmation(quotationId, input);
          notice.success('报价确认已撤销');
          setOpen(false);
          try { await onChanged(); } catch { notice.warning('已撤销确认，请刷新报价'); }
          return true;
        } catch (error) {
          notice.error(error instanceof Error ? error.message : '撤销确认失败');
          return false;
        } finally { submitting.current = false; }
      }}
    >
      <Typography.Paragraph>撤销后，该报价将恢复为“已发送”，可以重新确认。</Typography.Paragraph>
      <ProFormSelect name="reason" label="原因" rules={[{ required: true, message: '请选择原因' }]}
        options={[{ value: 'mistake', label: '误操作' }, { value: 'customer_unconfirmed', label: '客户尚未确认' }, { value: 'other', label: '其他' }]} />
      <ProFormTextArea name="remark" label="备注" rules={[{ max: 500 }]} fieldProps={{ maxLength: 500, autoSize: { minRows: 2, maxRows: 4 } }} />
    </ModalForm>
  </>;
}
