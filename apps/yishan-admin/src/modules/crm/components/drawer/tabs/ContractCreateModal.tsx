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
import { App, Col, Row, Table, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QUOTATION_STATUSES, statusOf } from '@/modules/crm/domain/statuses';
import {
  type ContactRow,
  type ContractInput,
  type ContractRow,
  createContract,
  getQuotation,
  type OpportunityRow,
  type QuoteSeriesSummary,
  type QuotationResp,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

export interface ContractCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  customerName?: string;
  existingContacts: ContactRow[];
  existingOpportunities: OpportunityRow[];
  existingQuotations: QuoteSeriesSummary[];
  onSuccess?: (contract: ContractRow) => void;
  sourceQuotation?: QuotationResp;
  zIndex?: number;
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

function quotationFormValues(quotation: QuotationResp): Partial<FormValues> {
  return {
    name: `${quotation.opportunityName || quotation.name}合同`,
    quotationId: quotation.id,
    opportunityId: quotation.opportunityId ?? undefined,
    contactId: quotation.contactId ?? undefined,
    amountCents: quotation.totalCents / 100,
    description: quotation.remark ?? undefined,
  };
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
  sourceQuotation,
  zIndex = CRM_DIALOG_Z_INDEX,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number>();
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationResp>();
  const [quotationLoading, setQuotationLoading] = useState(false);
  const contractQuotation = sourceQuotation ?? selectedQuotation;
  const quotationPending =
    !sourceQuotation &&
    selectedQuotationId != null &&
    selectedQuotation?.id !== selectedQuotationId;
  const quotationLinked =
    Boolean(sourceQuotation) || selectedQuotationId != null;

  // 合同来源只能选择已确认的当前报价版本。
  const activeQuotations = useMemo(
    () =>
      existingQuotations.filter((q) => {
        const s = statusOf(q.currentStatus ?? 'draft', QUOTATION_STATUSES);
        return s.value === 'accepted';
      }),
    [existingQuotations],
  );

  const quotationOptions = sourceQuotation
    ? [{ value: sourceQuotation.id, label: sourceQuotation.name }]
    : activeQuotations.map((q) => ({
        value: q.currentQuoteId,
        label: q.title ?? '',
      }));
  const opportunityOptions = contractQuotation?.opportunityId
    ? [
        {
          value: contractQuotation.opportunityId,
          label: contractQuotation.opportunityName ?? '',
        },
      ]
    : existingOpportunities
        .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
        .map((o) => ({ value: o.id, label: o.name }));
  const contactOptions = contractQuotation?.contactId
    ? [
        {
          value: contractQuotation.contactId,
          label: contractQuotation.contactName ?? '',
        },
      ]
    : existingContacts.map((c) => ({ value: c.id, label: c.name }));

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
    if (firstQuote?.title) return `${firstQuote.title}合同`;
    const firstOpp = existingOpportunities[0];
    if (firstOpp?.name) return `${firstOpp.name}合同`;
    if (customerName) return `${customerName}合同`;
    return undefined;
  }, [activeQuotations, existingOpportunities, customerName]);

  const initialValues = useMemo<FormValues>(
    () =>
      sourceQuotation
        ? quotationFormValues(sourceQuotation)
        : {
            name: defaultName,
            contactId: defaultContactId,
          },
    [defaultName, defaultContactId, sourceQuotation],
  );

  useEffect(() => {
    if (open) return;
    setSelectedQuotationId(undefined);
    setSelectedQuotation(undefined);
    setQuotationLoading(false);
    formRef.current?.resetFields();
  }, [open]);

  useEffect(() => {
    if (!open || sourceQuotation || selectedQuotationId == null) return;
    let cancelled = false;
    setQuotationLoading(true);
    getQuotation(selectedQuotationId)
      .then((quotation) => {
        if (cancelled) return;
        setSelectedQuotation(quotation);
        formRef.current?.setFieldsValue(quotationFormValues(quotation));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          message.error(
            err instanceof Error ? err.message : '报价单读取失败，请重新选择',
          );
      })
      .finally(() => {
        if (!cancelled) setQuotationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceQuotation, selectedQuotationId, message]);

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
        zIndex,
        width: 720,
        style: { maxWidth: 'calc(100vw - 48px)' },
        // Row 的负边距会触发横向滚动条，导致悬停时弹窗尺寸反复切换。
        styles: { body: { overflowX: 'hidden' } },
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting, disabled: quotationPending },
      }}
      onFinish={async (raw) => {
        if (submittingRef.current) return false;
        if (
          raw.quotationId != null &&
          contractQuotation?.id !== raw.quotationId
        ) {
          message.error('请等待报价单读取完成，读取失败时请重新选择');
          return false;
        }
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
          if (dayjs(end).isBefore(dayjs(start))) {
            message.error('合同结束日期不能早于开始日期');
            return false;
          }
        }

        const [start, end] = raw.dateRange ?? [];
        const input: ContractInput = {
          customerId,
          name,
          quotationId: contractQuotation?.id ?? raw.quotationId ?? null,
          opportunityId: contractQuotation
            ? contractQuotation.opportunityId
            : (raw.opportunityId ?? null),
          contactId: contractQuotation
            ? contractQuotation.contactId
            : (raw.contactId ?? null),
          amountCents,
          signedAt: raw.signedAt
            ? dayjs(raw.signedAt).startOf('day').toISOString()
            : undefined,
          effectiveAt: start
            ? dayjs(start).startOf('day').toISOString()
            : undefined,
          expiresAt: end ? dayjs(end).endOf('day').toISOString() : undefined,
          description: raw.description?.trim() || undefined,
        };

        setSubmitting(true);
        submittingRef.current = true;
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
          submittingRef.current = false;
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
            fieldProps={{ loading: quotationLoading }}
            disabled={Boolean(sourceQuotation) || quotationOptions.length === 0}
            onChange={(quotationId) => {
              const nextQuotationId =
                typeof quotationId === 'number' ? quotationId : undefined;
              setSelectedQuotationId(nextQuotationId);
              setSelectedQuotation(undefined);
              setQuotationLoading(nextQuotationId != null);
              formRef.current?.setFieldsValue({
                name: defaultName,
                opportunityId: undefined,
                contactId:
                  nextQuotationId == null ? defaultContactId : undefined,
                amountCents: undefined,
                description: undefined,
              });
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
            disabled={quotationLinked || opportunityOptions.length === 0}
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
            disabled={quotationLinked || contactOptions.length === 0}
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
      {contractQuotation && (
        <>
          <Typography.Paragraph>
            客户：{contractQuotation.customerName} · 负责人：
            {contractQuotation.ownerUserName || '—'}
          </Typography.Paragraph>
          <Table<QuotationResp['items'][number]>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={contractQuotation.items}
            columns={[
              { title: '来源报价明细', dataIndex: 'productNameSnapshot' },
              {
                title: '数量',
                dataIndex: 'quantityCents',
                render: (value: number) => value / 10000,
              },
              {
                title: '单价',
                dataIndex: 'unitPriceCents',
                align: 'right',
                render: (value: number) =>
                  `¥${(value / 100).toLocaleString('zh-CN')}`,
              },
              {
                title: '金额',
                dataIndex: 'lineAmountCents',
                align: 'right',
                render: (value: number) =>
                  `¥${(value / 100).toLocaleString('zh-CN')}`,
              },
            ]}
          />
        </>
      )}
    </ModalForm>
  );
};

export default ContractCreateModal;
