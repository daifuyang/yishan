import { Drawer, Form, Input, InputNumber, Select, Space, Button, Typography } from 'antd'
import React, { useEffect } from 'react'
import type { CustomerWorkspaceFilters } from '../types'

interface CustomerAdvancedFilterDrawerProps {
  open: boolean
  value: CustomerWorkspaceFilters
  onClose: () => void
  onApply: (filters: CustomerWorkspaceFilters) => void
}

const CustomerAdvancedFilterDrawer = ({
  open,
  value,
  onClose,
  onApply,
}: CustomerAdvancedFilterDrawerProps) => {
  const [form] = Form.useForm<CustomerWorkspaceFilters>()

  useEffect(() => {
    if (open) form.setFieldsValue(value)
  }, [form, open, value])

  return (
    <Drawer
      destroyOnClose
      open={open}
      title="高级筛选"
      width={420}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={() => form.resetFields()}>清空</Button>
          <Button type="primary" onClick={() => form.submit()}>
            应用筛选
          </Button>
        </Space>
      }
    >
      <Form<CustomerWorkspaceFilters>
        form={form}
        layout="vertical"
        onFinish={(filters) => {
          onApply(filters)
          onClose()
        }}
      >
        <Form.Item label="客户状态 ID" name="statusId">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="客户来源 ID" name="sourceId">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="行业" name="industry">
          <Input allowClear maxLength={64} placeholder="例如：软件与信息服务" />
        </Form.Item>
        <Form.Item label="负责人 ID" name="ownerUserId">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="协同人 ID" name="collaboratorUserId">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="标签 ID" name="tagId">
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="归属状态" name="poolStatus">
          <Select
            allowClear
            options={[
              { value: 'owned', label: '已分配' },
              { value: 'public', label: '公海' },
            ]}
          />
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">
        自定义视图将在具备可保存的服务端能力后开放。
      </Typography.Text>
    </Drawer>
  )
}

export default CustomerAdvancedFilterDrawer
