import { ModalForm, ProFormTextArea } from '@ant-design/pro-components';
import { Form, message } from 'antd';
import React, { useState } from 'react';
import { voidQuotation } from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';

export default function QuoteVoidModal({
  quotationId,
  renderTrigger,
  onChanged,
}: {
  quotationId: number;
  renderTrigger: (open: () => void) => React.ReactNode;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();
  const [notice, holder] = message.useMessage();
  return (
    <>
      {holder}
      {renderTrigger(() => {
        form.resetFields();
        setOpen(true);
      })}
      <ModalForm<{ reason: string }>
        title="作废报价"
        width={560}
        form={form}
        open={open}
        onOpenChange={setOpen}
        modalProps={{
          destroyOnHidden: true,
          mask: { closable: false },
          zIndex: CRM_DIALOG_Z_INDEX + 30,
        }}
        submitter={{
          searchConfig: { submitText: '作废', resetText: '取消' },
          submitButtonProps: { danger: true },
        }}
        onFinish={async ({ reason }) => {
          try {
            await voidQuotation(quotationId, reason.trim());
            notice.success('报价已作废');
            setOpen(false);
            try {
              await onChanged();
            } catch {
              notice.warning('报价已作废，请刷新列表');
            }
            return true;
          } catch (error) {
            notice.error(
              error instanceof Error ? error.message : '报价作废失败',
            );
            return false;
          }
        }}
      >
        <ProFormTextArea
          name="reason"
          label="作废原因"
          placeholder="请填写作废原因"
          rules={[{ required: true, whitespace: true }, { max: 500 }]}
          fieldProps={{
            maxLength: 500,
            showCount: true,
            autoSize: { minRows: 3, maxRows: 5 },
          }}
        />
      </ModalForm>
    </>
  );
}
