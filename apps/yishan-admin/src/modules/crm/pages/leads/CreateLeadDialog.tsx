/**
 * CreateLeadDialog：新建线索弹窗。
 *
 * 薄包装：固定 mode='create'、标题、提交流程。
 * 业务字段（负责人 / 状态 / 转化 / 公海）一律不在此入口暴露，
 * 由服务端根据当前登录用户自动绑定 createdBy/ownerUserId。
 */

import { message } from 'antd';
import { createLead, type LeadRow } from '@/services/crm';
import { LeadForm, type LeadFormValues } from './leadForm';

export interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (lead: LeadRow) => void;
}

export default function CreateLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLeadDialogProps) {
  const handleSubmit = async (values: LeadFormValues): Promise<void> => {
    const name = typeof values.name === 'string' ? values.name.trim() : values.name;
    try {
      const lead = await createLead({ ...values, name } as Parameters<typeof createLead>[0]);
      message.success('线索创建成功');
      onCreated?.(lead);
      onOpenChange(false);
    } catch (err: any) {
      // 抛回给 ProForm 让其保留输入；错误提示由全局拦截/控制台打印
      message.error(err?.message ?? '线索创建失败');
      throw err
    }
  };

  return (
    <LeadForm
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={handleSubmit}
    />
  );
}
