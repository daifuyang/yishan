import { PlusOutlined } from '@ant-design/icons'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { useModel } from '@umijs/max'
import { Button } from 'antd'
import React, { useRef } from 'react'
import { listOpportunities, type OpportunityRow } from '@/services/crm'
import { OPPORTUNITY_STAGES } from '@/modules/crm/domain/statuses'
import OpportunitySave from '../../components/opportunity/OpportunitySave'
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList'

const columns: ProColumns<OpportunityRow>[] = [
  { title: '商机名称', dataIndex: 'name' },
  { title: '客户', dataIndex: 'customerId', search: false },
  { title: '阶段', dataIndex: 'stage', valueEnum: Object.fromEntries(OPPORTUNITY_STAGES.map((item) => [item.value, item.label])) },
  { title: '预计金额', dataIndex: 'amountCents', search: false, render: (_, row) => formatMoney(row.amountCents) },
  { title: '预计成交', dataIndex: 'expectedCloseDate', valueType: 'date', search: false },
]

export default function OpportunitiesPage() {
  const actionRef = useRef<ActionType | undefined>(undefined)
  const { initialState } = useModel('@@initialState')
  return <CrmEntityList actionRef={actionRef} title="商机" columns={columns} load={listOpportunities} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof OpportunityRow, label: String(column.title) }))} createAction={<OpportunitySave ownerId={initialState?.currentUser?.id} onFinish={() => actionRef.current?.reload()}><Button type="primary" icon={<PlusOutlined />}>新建商机</Button></OpportunitySave>} />
}
