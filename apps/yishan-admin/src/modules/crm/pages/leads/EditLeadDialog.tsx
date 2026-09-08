/**
 * EditLeadDialog：编辑线索普通资料。
 *
 * 范围：
 *   - 联系人 / 公司 / 手机 / 微信 / 邮箱 / 来源 / 意向说明
 *   - 「更多联系方式」：电话 / QQ（编辑模式专属）
 *
 * 不允许在此修改：
 *   - 负责人 → TransferLeadDialog
 *   - 状态 → qualify / disqualify
 *   - 公海状态 → 退回公海
 *   - 转化客户 / 转化时间 → 转换客户
 */

import { message } from 'antd';
import { useEffect, useState } from 'react';
import { listSources, type LeadRow, updateLead } from '@/services/crm';
import { LeadForm, type LeadFormValues } from './leadForm';

export interface EditLeadDialogProps {
  open: boolean;
  /** 关闭后清空，避免下次打开显示旧数据。 */
  onOpenChange: (open: boolean) => void;
  /** 编辑目标线索；null 时弹窗内容为空（不显示）。 */
  lead: LeadRow | null;
  onUpdated?: (lead: LeadRow) => void;
}

const leadToInitialValues = (lead: LeadRow): LeadFormValues => ({
  name: lead.name ?? undefined,
  companyName: lead.companyName ?? undefined,
  mobile: lead.mobile ?? undefined,
  wechat: lead.wechat ?? undefined,
  email: lead.email ?? undefined,
  phone: lead.phone ?? undefined,
  qq: lead.qq ?? undefined,
  intention: lead.intention ?? undefined,
  sourceId: lead.sourceId ?? null,
});

export default function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  onUpdated,
}: EditLeadDialogProps) {
  const [sourceOptions, setSourceOptions] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listSources({ page: 1, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setSourceOptions(
          res.data
            .filter((s) => s.enabled === 1)
            .map((s) => ({ label: s.name, value: s.id })),
        );
      })
      .catch(() => {
        // 来源加载失败不阻塞编辑；用户可手输 sourceId 或跳过。
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async (values: LeadFormValues): Promise<void> => {
    if (!lead) return;
    try {
      const updated = await updateLead(lead.id, values as Parameters<typeof updateLead>[1]);
      message.success('线索已保存');
      onUpdated?.(updated);
      onOpenChange(false);
    } catch (err: any) {
      message.error(err?.message ?? '保存失败');
      throw err
    }
  };

  return (
    <LeadForm
      mode="edit"
      open={open && Boolean(lead)}
      onOpenChange={onOpenChange}
      initialValues={lead ? leadToInitialValues(lead) : undefined}
      sourceOptions={sourceOptions}
      onSubmit={handleSubmit}
    />
  );
}