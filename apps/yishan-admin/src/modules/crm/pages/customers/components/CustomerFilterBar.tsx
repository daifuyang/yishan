import { FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space } from 'antd'
import React from 'react'
import type { CustomerWorkspaceQuery } from '../types'

const TYPE_OPTIONS = [
  { value: 'enterprise', label: '企业客户' },
  { value: 'individual', label: '个人客户' },
]

const LEVEL_OPTIONS = [
  { value: 'important', label: '重点' },
  { value: 'high', label: '高价值' },
  { value: 'normal', label: '普通' },
]

interface CustomerFilterBarProps {
  query: CustomerWorkspaceQuery
  onChange: (filters: Partial<CustomerWorkspaceQuery>) => void
  onOpenAdvanced: () => void
}

const CustomerFilterBar = ({ query, onChange, onOpenAdvanced }: CustomerFilterBarProps) => (
  <div className="customerWorkspaceFilterBar">
    <Space wrap size={8}>
      <Input.Search
        allowClear
        aria-label="搜索客户"
        className="customerWorkspaceSearch"
        defaultValue={query.keyword}
        placeholder="搜索客户、联系人或手机号"
        prefix={<SearchOutlined />}
        onSearch={(keyword) => onChange({ keyword: keyword || undefined })}
      />
      <Select
        allowClear
        aria-label="客户类型"
        className="customerWorkspaceSelect"
        options={TYPE_OPTIONS}
        placeholder="客户类型"
        value={query.type}
        onChange={(type) => onChange({ type })}
      />
      <Select
        allowClear
        aria-label="客户等级"
        className="customerWorkspaceSelect"
        options={LEVEL_OPTIONS}
        placeholder="客户等级"
        value={query.level}
        onChange={(level) => onChange({ level })}
      />
      <Button icon={<FilterOutlined />} onClick={onOpenAdvanced}>
        高级筛选
      </Button>
      <Button
        aria-label="重置筛选"
        icon={<ReloadOutlined />}
        onClick={() => onChange({ keyword: undefined, type: undefined, level: undefined, statusId: undefined, sourceId: undefined, industry: undefined, ownerUserId: undefined, collaboratorUserId: undefined, tagId: undefined, poolStatus: undefined, createdAtFrom: undefined, createdAtTo: undefined, lastFollowUpAtFrom: undefined, lastFollowUpAtTo: undefined, nextFollowUpAtFrom: undefined, nextFollowUpAtTo: undefined })}
      >
        重置
      </Button>
    </Space>
  </div>
)

export default CustomerFilterBar
