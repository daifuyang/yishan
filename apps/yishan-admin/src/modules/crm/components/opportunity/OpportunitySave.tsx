/**
 * 商机创建 / 编辑（trigger + Form.useForm 模式），仅给独立页面
 * `/crm/opportunities` 用。Drawer 上下文下走 OpportunityCreateModal。
 *
 * 保留 trigger 模式是为了让独立页面维持原有 UX（不需要 parent 控制 modal
 * 状态、不需要 ownerId / customerId prop）。
 */

import {
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Col, Form, message, Row } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { opportunityStageConfig } from '@/modules/crm/domain/statuses';
import type { ContactRow, OpportunityCreateInput } from '@/services/crm';
import {
  createOpportunity,
  listContactsByCustomer,
  listCustomers,
} from '@/services/crm';

export interface OpportunitySaveProps {
  children: React.ReactElement<{ onClick?: () => void }>;
  customerId?: number;
  customerName?: string;
  ownerId?: number;
  onFinish?: () => void | Promise<void>;
}

interface FormValues {
  name: string;
  customerId?: number;
  primaryContactId?: number | null;
  amount?: number | null;
  expectedCloseDate?: string | null;
  stage?: 'requirement' | 'proposal' | 'negotiation';
  remark?: string;
}

const stageOptions = Object.entries(opportunityStageConfig)
  .filter(([key]) => !['won', 'lost'].includes(key))
  .map(([value, item]) => ({ value, label: item.label }));

export default function OpportunitySave({
  children,
  customerId,
  ownerId,
  onFinish,
}: OpportunitySaveProps) {
  const [form] = Form.useForm<FormValues>();
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!customerId) return;
    void listContactsByCustomer(customerId)
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [customerId]);

  const resetForOpen = () => {
    form.resetFields();
    form.setFieldsValue({
      customerId,
      stage: 'requirement',
      primaryContactId: null,
    });
    if (customerId)
      void listContactsByCustomer(customerId)
        .then(setContacts)
        .catch(() => setContacts([]));
  };

  return (
    <ModalForm<FormValues>
      title="新建商机"
      width={680}
      layout="vertical"
      grid
      trigger={React.cloneElement(children, { onClick: resetForOpen })}
      form={form}
      onFinish={async (values) => {
        const resolvedCustomerId = customerId ?? values.customerId;
        if (!resolvedCustomerId || !ownerId) {
          message.error('缺少客户或负责人信息');
          return false;
        }
        try {
          const input: OpportunityCreateInput = {
            name: values.name.trim(),
            customerId: resolvedCustomerId,
            ownerId,
            primaryContactId: values.primaryContactId ?? null,
            stage: values.stage ?? 'requirement',
            ...(values.amount == null
              ? {}
              : { amountCents: Math.round(values.amount * 100) }),
            ...(values.expectedCloseDate
              ? {
                  expectedCloseDate: dayjs(values.expectedCloseDate)
                    .startOf('day')
                    .toISOString(),
                }
              : {}),
            ...(values.remark?.trim() ? { remark: values.remark.trim() } : {}),
          };
          await createOpportunity(input);
          message.success('商机创建成功');
          await onFinish?.();
          form.resetFields();
          return true;
        } catch (error) {
          message.error((error as Error).message || '商机创建失败，请稍后重试');
          return false;
        }
      }}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        styles: {
          body: {
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
            padding: '8px 24px 4px',
          },
        },
      }}
      submitter={{
        searchConfig: { submitText: '创建商机', resetText: '取消' },
      }}
    >
      {!customerId && (
        <ProFormSelect
          name="customerId"
          label="客户"
          showSearch
          rules={[{ required: true }]}
          request={async ({ keyWords }) =>
            (
              await listCustomers({ page: 1, pageSize: 50, keyword: keyWords })
            ).data.map((item) => ({ value: item.id, label: item.name }))
          }
          fieldProps={{
            onChange: (value) => {
              form.setFieldValue('primaryContactId', undefined);
              setContacts([]);
              const nextCustomerId = Number(value);
              if (nextCustomerId) {
                void listContactsByCustomer(nextCustomerId)
                  .then(setContacts)
                  .catch(() => setContacts([]));
              }
            },
          }}
        />
      )}
      <ProFormText
        name="name"
        label="商机名称"
        placeholder="请输入商机名称"
        rules={[{ required: true, whitespace: true, max: 200 }]}
      />
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <ProFormSelect
            name="primaryContactId"
            label="联系人"
            placeholder={contacts.length ? '请选择联系人' : '暂无联系人'}
            options={contacts.map((item) => ({
              value: item.id,
              label: [item.name, item.position].filter(Boolean).join(' · '),
            }))}
            allowClear
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormDigit
            name="amount"
            label="预计金额"
            placeholder="请输入预计金额"
            fieldProps={{ min: 0, precision: 2, prefix: '¥' }}
          />
        </Col>
      </Row>
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <ProFormDatePicker
            name="expectedCloseDate"
            label="预计成交日期"
            fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
          />
        </Col>
        <Col xs={24} md={12}>
          <ProFormSelect
            name="stage"
            label="销售阶段"
            placeholder="请选择销售阶段"
            options={stageOptions}
            rules={[{ required: true, message: '请选择销售阶段' }]}
          />
        </Col>
      </Row>
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充本次商机的需求、背景等信息"
        fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
      />
    </ModalForm>
  );
}
