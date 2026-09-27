import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { Button, Col, Form, message, Row } from 'antd'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import type { ContactRow, OpportunityCreateInput } from '@/services/crm'
import { createOpportunity, listContactsByCustomer, listCustomers, listProducts } from '@/services/crm'
import { opportunityStageConfig } from '@/modules/crm/domain/statuses'

export interface OpportunitySaveProps {
  children: React.ReactElement<{ onClick?: () => void }>
  customerId?: number
  customerName?: string
  ownerId?: number
  onFinish?: () => void | Promise<void>
}

interface FormValues {
  name: string
  customerId?: number
  primaryContactId?: number | null
  amount?: number | null
  expectedCloseDate?: string | null
  stage?: 'requirement' | 'proposal' | 'negotiation'
  requirement?: string
  remark?: string
}

export default function OpportunitySave({ children, customerId, customerName, ownerId, onFinish }: OpportunitySaveProps) {
  const [form] = Form.useForm<FormValues>()
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [selectedCustomerName, setSelectedCustomerName] = useState(customerName ?? '')

  useEffect(() => {
    if (!customerId) return
    void listContactsByCustomer(customerId).then(setContacts).catch(() => setContacts([]))
  }, [customerId])

  const resetForOpen = () => {
    form.resetFields()
    setSelectedCustomerName(customerName ?? '')
    form.setFieldsValue({ customerId, stage: 'requirement', primaryContactId: null })
    if (customerId) void listContactsByCustomer(customerId).then(setContacts).catch(() => setContacts([]))
  }

  return <ModalForm<FormValues>
    title="新建商机"
    width={720}
    layout="vertical"
    grid
    trigger={React.cloneElement(children, { onClick: resetForOpen })}
    form={form}
    onFinish={async (values) => {
      const resolvedCustomerId = customerId ?? values.customerId
      if (!resolvedCustomerId || !ownerId) {
        message.error('缺少客户或负责人信息')
        return false
      }
      try {
        const input: OpportunityCreateInput = {
          name: values.name.trim(), customerId: resolvedCustomerId, ownerId,
          primaryContactId: values.primaryContactId ?? null, stage: values.stage ?? 'requirement',
          ...(values.amount == null ? {} : { amountCents: Math.round(values.amount * 100) }),
          ...(values.expectedCloseDate ? { expectedCloseDate: dayjs(values.expectedCloseDate).format('YYYY-MM-DDT00:00:00.000Z') } : {}),
          ...(values.requirement?.trim() ? { requirement: values.requirement.trim() } : {}),
          ...(values.remark?.trim() ? { remark: values.remark.trim() } : {}),
        }
        await createOpportunity(input)
        message.success('商机创建成功')
        await onFinish?.()
        form.resetFields()
        return true
      } catch (error) {
        message.error((error as Error).message || '商机创建失败，请稍后重试')
        return false
      }
    }}
    modalProps={{ destroyOnHidden: true, maskClosable: false, styles: { body: { maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', padding: '8px 24px 4px' } } }}
    submitter={{ searchConfig: { submitText: '创建商机', resetText: '取消' } }}
  >
    {customerId && <div style={{ marginBottom: 16, color: '#8c8c8c', fontSize: 13 }}>{customerName ?? selectedCustomerName}</div>}
    {!customerId && <ProFormSelect name="customerId" label="客户" showSearch rules={[{ required: true }]} request={async ({ keyWords }) => (await listCustomers({ page: 1, pageSize: 50, keyword: keyWords })).data.map((item) => ({ value: item.id, label: item.name }))} fieldProps={{ onChange: (value, option) => { setSelectedCustomerName((option as { label?: string })?.label ?? ''); form.setFieldValue('primaryContactId', undefined); setContacts([]); const nextCustomerId = Number(value); if (nextCustomerId) void listContactsByCustomer(nextCustomerId).then(setContacts).catch(() => setContacts([])) } }} />}
    <ProFormText name="name" label="商机名称" placeholder="请输入商机名称" rules={[{ required: true, whitespace: true, max: 200 }]} />
    <Row gutter={16}>
      <Col xs={24} md={12}><ProFormSelect name="primaryContactId" label="联系人" disabled={!customerId && !form.getFieldValue('customerId')} placeholder={contacts.length ? '请选择联系人' : '暂无联系人'} options={contacts.map((item) => ({ value: item.id, label: [item.name, item.position].filter(Boolean).join(' · ') }))} /></Col>
      <Col xs={24} md={12}><ProFormDigit name="amount" label="预计金额" placeholder="请输入预计金额" fieldProps={{ min: 0, precision: 2, addonBefore: '¥' }} /></Col>
    </Row>
    <Row gutter={16}>
      <Col xs={24} md={12}><ProFormDatePicker name="expectedCloseDate" label="预计成交日期" fieldProps={{ style: { width: '100%' }, format: 'YYYY-MM-DD' }} /></Col>
      <Col xs={24} md={12}><ProFormSelect name="stage" label="销售阶段" options={Object.entries(opportunityStageConfig).filter(([key]) => !['won', 'lost'].includes(key)).map(([value, item]) => ({ value, label: item.label }))} /></Col>
    </Row>
    <ProFormTextArea name="remark" label="备注" placeholder="补充本次商机的需求、背景等信息" fieldProps={{ autoSize: { minRows: 3, maxRows: 4 }, maxLength: 500 }} />
  </ModalForm>
}
