import { message } from 'antd';
import { createPoolLead, type LeadRow } from '@/services/crm';
import { LeadForm, type LeadFormValues } from '../leads/leadForm';

export default function CreatePoolLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (lead: LeadRow) => void;
}) {
  return (
    <LeadForm
      mode="create"
      title="新建公海线索"
      submitText="加入线索池"
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={async (values: LeadFormValues) => {
        try {
          const lead = await createPoolLead(values);
          message.success('线索已加入线索池');
          onCreated?.(lead);
          onOpenChange(false);
        } catch (error: any) {
          message.error(error?.message ?? '加入线索池失败');
          throw error;
        }
      }}
    />
  );
}
