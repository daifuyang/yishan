/**
 * 登记回款 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则：
 *   - 不暴露「所属客户」「负责人」「回款单号」「回款状态」
 *     （由上下文 / 系统自动生成 / 服务层硬编码）
 *   - 字段严格按 spec：关联合同 / 本次回款金额 / 回款日期 / 收款方式 /
 *     交易流水号 / 备注
 *   - 沿用 ContactCreateModal 的 controlled-open + formRef + useState submitting + try/finally 模式
 *   - 选合同后展示：合同金额 / 已回款 / 待回款（secondary text，非 Card）
 *   - 输入金额时实时反馈「登记后：已回款 X · 待回款 Y」
 *   - 仅 create 模式（编辑流后续单独做）
 *   - submit 按钮文案「确认登记」（贴合「登记事实」语义）
 *   - 失败保留用户已输入数据，Modal 不关
 *
 * 回款 ≠ 修改合同状态：MVP 不联动 contract.status。
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Form, Row, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createPayment,
  PAYMENT_METHOD_OPTIONS,
  type PaymentContractSummary,
  type PaymentInput,
  type PaymentRow,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

const { Text } = Typography;

export interface PaymentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前客户的合同列表（含已汇总 paid / outstanding）。 */
  contracts: PaymentContractSummary[];
  onSuccess?: (payment: PaymentRow) => void;
}

interface FormValues {
  contractId?: number;
  amountYuan?: number;
  paidAt?: Dayjs;
  methodCode?: string;
  transactionNo?: string;
  remark?: string;
}

const money = (cents: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

const PaymentCreateModal: React.FC<PaymentCreateModalProps> = ({
  open,
  onOpenChange,
  contracts,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Form 内对 contractId / amountYuan 订阅，用于 contextual info + 实时反馈
  const form = Form.useFormInstance();
  const contractId = Form.useWatch('contractId', form);
  const amountYuan = Form.useWatch('amountYuan', form);

  const contractOptions = useMemo(
    () =>
      contracts.map((c) => {
        const amount = money(c.contractAmountCents);
        const outstanding = money(c.outstandingCents);
        return {
          value: c.contractId,
          label: `${c.contractNo} · ${c.contractName} · ${amount} · 待回款 ${outstanding}`,
        };
      }),
    [contracts],
  );

  const selectedContract: PaymentContractSummary | undefined = useMemo(
    () => contracts.find((c) => c.contractId === contractId),
    [contracts, contractId],
  );

  // 实时反馈：登记后：已回款 X · 待回款 Y
  const projectedPaid = useMemo(() => {
    if (!selectedContract) return 0;
    const input = typeof amountYuan === 'number' ? amountYuan : 0;
    return selectedContract.paidCents + Math.round(input * 100);
  }, [selectedContract, amountYuan]);

  const projectedOutstanding = useMemo(() => {
    if (!selectedContract) return 0;
    return Math.max(0, selectedContract.contractAmountCents - projectedPaid);
  }, [selectedContract, projectedPaid]);

  // 智能默认金额：选合同时 = 当前 outstanding
  const handleContractChange = (next: number | undefined) => {
    const c = contracts.find((x) => x.contractId === next);
    if (!c) return;
    formRef.current?.setFieldsValue({
      amountYuan: c.outstandingCents > 0 ? c.outstandingCents / 100 : 0,
    });
  };

  // 默认回款日期：今天
  const initialValues = useMemo<FormValues>(
    () => ({
      contractId: undefined,
      amountYuan: undefined,
      paidAt: dayjs().startOf('day') as unknown as Dayjs,
      methodCode: undefined,
      transactionNo: undefined,
      remark: undefined,
    }),
    [],
  );

  useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
  }, [open]);

  return (
    <ModalForm<FormValues>
      key="payment-create"
      open={open}
      onOpenChange={onOpenChange}
      title="登记回款"
      width={640}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
        width: 640,
        style: { maxWidth: 'calc(100vw - 48px)' },
      }}
      submitter={{
        searchConfig: { submitText: '确认登记', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw) => {
        if (!raw.contractId) {
          message.error('请选择关联合同');
          return false;
        }
        const amountCents = Math.round((raw.amountYuan ?? 0) * 100);
        if (amountCents <= 0) {
          message.error('本次回款金额必须大于 0');
          return false;
        }
        if (!raw.paidAt) {
          message.error('请选择回款日期');
          return false;
        }

        const input: PaymentInput = {
          amountCents,
          paidAt: raw.paidAt.startOf('day').toISOString(),
          methodCode: raw.methodCode,
          transactionNo: raw.transactionNo?.trim() || null,
          remark: raw.remark?.trim() || null,
        };

        setSubmitting(true);
        try {
          const saved = await createPayment(raw.contractId, input);
          message.success('回款登记成功');
          onSuccess?.(saved);
          onOpenChange(false);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '回款登记失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <ProFormSelect
        name="contractId"
        label="关联合同"
        placeholder={contractOptions.length ? '请选择合同' : '暂无合同'}
        options={contractOptions}
        disabled={contractOptions.length === 0}
        rules={[{ required: true, message: '请选择关联合同' }]}
        onChange={(v) => handleContractChange(v as number | undefined)}
      />

      {selectedContract && (
        <div
          style={{
            marginTop: -12,
            marginBottom: 16,
            color: '#8c8c8c',
            fontSize: 13,
          }}
        >
          当前合同金额{' '}
          <Text strong>{money(selectedContract.contractAmountCents)}</Text>
          {' · '}
          已回款 <Text strong>{money(selectedContract.paidCents)}</Text>
          {' · '}
          待回款 <Text strong>{money(selectedContract.outstandingCents)}</Text>
        </div>
      )}

      <Row gutter={24}>
        <Col span={12}>
          <ProFormDigit
            name="amountYuan"
            label="本次回款金额"
            placeholder="请输入回款金额"
            rules={[
              {
                validator: async (_rule: unknown, value: unknown) => {
                  if (value == null || value === '') return Promise.resolve();
                  if (typeof value === 'number' && value <= 0) {
                    return Promise.reject(new Error('回款金额必须大于 0'));
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
          {selectedContract && (
            <div
              style={{
                marginTop: -8,
                marginBottom: 12,
                color: '#8c8c8c',
                fontSize: 12,
              }}
            >
              登记后：已回款{' '}
              <Text strong style={{ color: '#262626' }}>
                {money(projectedPaid)}
              </Text>
              {' · '}
              待回款{' '}
              <Text strong style={{ color: '#262626' }}>
                {money(projectedOutstanding)}
              </Text>
            </div>
          )}
        </Col>
        <Col span={12}>
          <ProFormDatePicker
            name="paidAt"
            label="回款日期"
            placeholder="请选择回款日期"
            fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
            rules={[{ required: true, message: '请选择回款日期' }]}
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <ProFormSelect
            name="methodCode"
            label="收款方式"
            placeholder="请选择收款方式（可选）"
            options={PAYMENT_METHOD_OPTIONS.map((m) => ({
              value: m.value,
              label: m.label,
            }))}
            allowClear
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="transactionNo"
            label="交易流水号"
            placeholder="银行 / 支付宝 / 微信 流水号（可选）"
            fieldProps={{ maxLength: 64 }}
          />
        </Col>
      </Row>

      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充本次回款说明等（可选）"
        fieldProps={{
          autoSize: { minRows: 2, maxRows: 4 },
          maxLength: 500,
          showCount: true,
        }}
      />
    </ModalForm>
  );
};

export default PaymentCreateModal;
