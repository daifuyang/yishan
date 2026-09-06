/**
 * TransferLeadDialog：转移线索负责人。
 *
 * 独立于编辑表单，避免「编辑 = 修改负责人」的语义混淆。
 * 服务端走 assign（lead.transfer）业务动作，
 * 自动写「负责人变更 X → Y」Activity。
 */

import {
  ModalForm,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { message } from 'antd';
import { useEffect, useState } from 'react';
import { assignLead, type LeadRow } from '@/services/crm';
import { getUserList } from '@/services/generated/sysUsers';

export interface TransferLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 转移目标线索；null 时弹窗内容为空。 */
  lead: LeadRow | null;
  onTransferred?: (lead: LeadRow) => void;
}

export default function TransferLeadDialog({
  open,
  onOpenChange,
  lead,
  onTransferred,
}: TransferLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getUserList({ page: 1, pageSize: 100, keyword: '' })
      .then((res) => {
        if (cancelled) return;
        const list = (res as any)?.data?.items ?? (res as any)?.data ?? [];
        setUserOptions(
          list.map((u: any) => ({
            label: u.realName ? `${u.realName}（${u.username ?? ''}）` : u.username ?? `用户 #${u.id}`,
            value: u.id,
          })),
        );
      })
      .catch(() => {
        // 用户列表加载失败不阻塞弹窗，用户仍可手输 ID。
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const currentOwner = lead
    ? lead.ownerUserName?.trim() || (lead.ownerUserId ? `用户 #${lead.ownerUserId}` : '暂未分配')
    : '—';

  return (
    <ModalForm
      open={open && Boolean(lead)}
      onOpenChange={onOpenChange}
      title={lead ? `转移线索：${lead.name || lead.companyName || `线索 #${lead.id}`}` : '转移线索'}
      width={520}
      submitter={{
        searchConfig: { submitText: '确认转移', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (values: any) => {
        if (!lead) return false;
        const targetUserId = Number(values.targetUserId);
        if (!targetUserId || Number.isNaN(targetUserId)) {
          message.error('请选择新负责人');
          return false;
        }
        setSubmitting(true);
        try {
          const updated = await assignLead(lead.id, targetUserId);
          message.success('线索已转移');
          onTransferred?.(updated);
          onOpenChange(false);
          return true;
        } catch (err: any) {
          message.error(err?.message ?? '转移失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div style={{ marginBottom: 16, color: '#475467', fontSize: 13 }}>
        当前负责人：{currentOwner}
      </div>
      <ProFormSelect
        name="targetUserId"
        label="转移给"
        placeholder="请选择新负责人"
        rules={[{ required: true, message: '请选择新负责人' }]}
        options={userOptions}
        fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
      />
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="可选，写下转移原因或上下文"
        fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
      />
    </ModalForm>
  );
}