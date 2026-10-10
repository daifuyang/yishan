import { Tabs } from 'antd'
import React from 'react'
import type { CustomerViewId } from '../types'

const VIEW_ITEMS: Array<{ key: CustomerViewId; label: string }> = [
  { key: 'all', label: '全部客户' },
  { key: 'mine', label: '我的客户' },
  { key: 'pending', label: '待跟进' },
  { key: 'important', label: '重点客户' },
  { key: 'pool', label: '公海' },
]

interface CustomerViewTabsProps {
  value: CustomerViewId
  onChange: (view: CustomerViewId) => void
}

const CustomerViewTabs = ({ value, onChange }: CustomerViewTabsProps) => (
  <Tabs
    activeKey={value}
    className="customerWorkspaceViewTabs"
    items={VIEW_ITEMS}
    onChange={(view) => onChange(view as CustomerViewId)}
  />
)

export default CustomerViewTabs
