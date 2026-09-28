/**
 * 合同创建 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则：
 *   - 不暴露「所属客户」「负责人」「合同编号」「合同状态」「签署状态」
 *     （由上下文确定 / 系统自动生成 / 不在 Create 阶段暴露）
 *   - 字段严格按 spec：合同名称 / 关联报价单 / 关联商机 / 合同金额 / 联系人 / 签约日期 / 合同期限 / 备注
 *   - 沿用 ContactCreateModal 的 controlled-open + formRef + useState submitting + try/finally 模式
 *   - 报价单自动带入：选 quotationId → opportunityId / contactId / amountCents / name 建议值
 *   - 商机自动带入：选 opportunityId → contactId（来自 primaryContactId）
 *   - 仅 create 模式（编辑流后续单独做）
 *   - 失败保留用户已输入数据，Modal 不关
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDatePicker,
  ProFormDateRangePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QUOTATION_STATUSES, statusOf } from '@/modules/crm/domain/statuses';
import {
  type ContactRow,
  type ContractInput,
  type ContractRow,
  createContract,
  type OpportunityRow,
  type QuotationRow,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

export interface ContractCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  customerName?: string;
  existingContacts: ContactRow[];
  existingOpportunities: OpportunityRow[];
  existingQuotations: QuotationRow[];
  onSuccess?: (contract: ContractRow) => void;
}

interface FormValues {
  name?: string;
  quotationId?: number;
  opportunityId?: number;
  contactId?: number;
  amountCents?: number;
  signedAt?: Dayjs;
  /** [start, end] —— 后端拆成 effectiveAt / expiresAt。 */
  dateRange?: [Dayjs, Dayjs];
  description?: string;
}

const ContractCreateModal: React.FC<ContractCreateModalProps> = ({
  open,
  onOpenChange,
  customerId,
  customerName,
  existingContacts,
  existingOpportunities,
  existingQuotations,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 只展示「有效状态」的报价单（draft / sent / accepted），过滤掉已作废 / 已被新版替代
  const activeQuotations = useMemo(
    () =>
      existingQuotations.filter((q) => {
        const s = statusOf(q.status, QUOTATION_STATUSES);
        return s.value !== 'voided' && s.value !== 'superseded';
      }),
    [existingQuotations],
  );

  const quotationOptions = useMemo(
    () =>
      activeQuotations.map((q) => {
        const amount =
          q.totalCents == null
            ? ''
            : `¥${(q.totalCents / 100).toLocaleString('zh-CN')}`;
        const statusLabel = statusOf(q.status, QUOTATION_STATUSES).label;
        const oppPart = q.opportunityName ? ` · ${q.opportunityName}` : '';
        return {
          value: q.id,
          label: `${q.quotationNo ?? ''} · ${q.name ?? ''}${oppPart} · ${amount} · ${statusLabel}`,
        };
      }),
    [activeQuotations],
  );

  const opportunityOptions = useMemo(
    () =>
      existingOpportunities
        .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
        .map((o) => {
          const amount =
            o.amountCents == null
              ? ''
              : `¥${(o.amountCents / 100).toLocaleString('zh-CN')}`;
          const stageLabel =
            o.stage === 'requirement'
              ? '需求确认'
              : o.stage === 'proposal'
                ? '方案报价'
                : o.stage === 'negotiation'
                  ? '商务谈判'
                  : o.stage;
          return {
            value: o.id,
            label: `${o.name} · ${amount}${stageLabel}`,
          };
        }),
    [existingOpportunities],
  );

  const contactOptions = useMemo(
    () =>
      existingContacts.map((c) => ({
        value: c.id,
        label: [c.name, c.position].filter(Boolean).join(' · '),
      })),
    [existingContacts],
  );

  // 智能默认 contactId：报价单 → 客户主联系人 → 第一联系人
  const defaultContactId = useMemo<number | undefined>(() => {
    const primary = existingContacts.find((c) => c.isPrimary === 1);
    if (primary) return primary.id;
    if (existingContacts.length === 1) return existingContacts[0]?.id;
    return undefined;
  }, [existingContacts]);

  // 智能默认 name：第一个有效报价单 → 第一个商机 → 客户名
  const defaultName = useMemo<string | undefined>(() => {
    const firstQuote = activeQuotations[0];
    if (firstQuote?.name) return `${firstQuote.name}合同`;
    const firstOpp = existingOpportunities[0];
    if (firstOpp?.name) return `${firstOpp.name}合同`;
    if (customerName) return `${customerName}合同`;
    return undefined;
  }, [activeQuotations, existingOpportunities, customerName]);

  const initialValues = useMemo<FormValues>(
    () => ({
      name: defaultName,
      quotationId: undefined,
      opportunityId: undefined,
      contactId: defaultContactId,
      amountCents: undefined,
      signedAt: undefined,
      dateRange: undefined,
      description: undefined,
    }),
    [defaultName, defaultContactId],
  );

  useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
  }, [open]);

  return (
    <ModalForm<FormValues>
      key="contract-create"
      open={open}
      onOpenChange={onOpenChange}
      title="新建合同"
      width={720}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
        width: 720,
        style: { maxWidth: 'calc(100vw - 48px)' },
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw) => {
        const name = (raw.name ?? '').trim();
        if (!name) {
          message.error('请填写合同名称');
          return false;
        }
        const amountCents = Math.round((raw.amountCents ?? 0) * 100);
        if (amountCents < 0) {
          message.error('合同金额不能为负');
          return false;
        }
        if (raw.dateRange && raw.dateRange.length === 2) {
          const [start, end] = raw.dateRange;
          if (end.isBefore(start)) {
            message.error('合同结束日期不能早于开始日期');
            return false;
          }
        }

        const [start, end] = raw.dateRange ?? [];
        const input: ContractInput = {
          customerId,
          name,
          quotationId: raw.quotationId ?? null,
          opportunityId: raw.opportunityId ?? null,
          contactId: raw.contactId ?? null,
          amountCents,
          signedAt: raw.signedAt
            ? raw.signedAt.startOf('day').toISOString()
            : undefined,
          effectiveAt: start ? start.startOf('day').toISOString() : undefined,
          expiresAt: end ? end.endOf('day').toISOString() : undefined,
          description: raw.description?.trim() || undefined,
        };

        setSubmitting(true);
        try {
          const saved = await createContract(input);
          message.success('合同创建成功');
          onSuccess?.(saved);
          onOpenChange(false);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '合同创建失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <ProFormText
        name="name"
        label="合同名称"
        placeholder="请输入合同名称"
        rules={[
          { required: true, whitespace: true, message: '请填写合同名称' },
          { max: 100, message: '合同名称最多 100 个字符' },
        ]}
      />

      <Row gutter={24}>
        <Col span={12}>
          <ProFormSelect
            name="quotationId"
            label="关联报价单"
            placeholder={
              quotationOptions.length ? '请选择报价单（可选）' : '暂无报价单'
            }
            options={quotationOptions}
            allowClear
            disabled={quotationOptions.length === 0}
            onChange={(quotationId) => {
              const q = activeQuotations.find((x) => x.id === quotationId);
              if (!q) return;
              const patch: Partial<FormValues> = {};
              if (q.opportunityId != null)
                patch.opportunityId = q.opportunityId;
              if (q.contactId != null) patch.contactId = q.contactId;
              if (q.totalCents != null) {
                patch.amountCents = Math.round(q.totalCents / 100);
              }
              // 名称仅当与当前 default name 一致时（或用户没改过）才覆盖
              const currentName = formRef.current?.getFieldValue('name');
              if (!currentName || currentName === defaultName) {
                if (q.name) patch.name = `${q.name}合同`;
              }
              formRef.current?.setFieldsValue(patch);
            }}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="opportunityId"
            label="关联商机"
            placeholder={
              opportunityOptions.length ? '请选择商机（可选）' : '暂无商机'
            }
            options={opportunityOptions}
            allowClear
            disabled={opportunityOptions.length === 0}
            onChange={(opportunityId) => {
              const o = existingOpportunities.find(
                (x) => x.id === opportunityId,
              );
              if (!o) return;
              if (o.primaryContactId != null) {
                formRef.current?.setFieldValue('contactId', o.primaryContactId);
              }
            }}
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <ProFormDigit
            name="amountCents"
            label="合同金额"
            placeholder="请输入合同金额"
            rules={[
              {
                validator: async (_rule: unknown, value: unknown) => {
                  if (value == null || value === '') {
                    return Promise.resolve();
                  }
                  if (typeof value === 'number' && value < 0) {
                    return Promise.reject(new Error('合同金额不能为负'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
            fieldProps={{
              min: 0,
              precision: 2,
              prefix: '¥',
            }}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="contactId"
            label="联系人"
            placeholder={
              contactOptions.length ? '请选择联系人（可选）' : '暂无联系人'
            }
            options={contactOptions}
            allowClear
            disabled={contactOptions.length === 0}
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <ProFormDatePicker
            name="signedAt"
            label="签约日期"
            placeholder="请选择签约日期（可选）"
            fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
          />
        </Col>
        <Col span={12}>
          <ProFormDateRangePicker
            name="dateRange"
            label="合同期限"
            placeholder={['开始日期', '结束日期']}
            fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
          />
        </Col>
      </Row>

      <ProFormTextArea
        name="description"
        label="备注"
        placeholder="补充合同说明等（可选）"
        fieldProps={{
          autoSize: { minRows: 2, maxRows: 4 },
          maxLength: 500,
          showCount: true,
        }}
      />
    </ModalForm>
  );
};

export default ContractCreateModal;
