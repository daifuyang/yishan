import { ProTable, type ProColumns } from '@ant-design/pro-components'
import { Empty, Skeleton, Tag, Tooltip } from 'antd'
import dayjs from 'dayjs'
import React, { useEffect, useMemo, useState } from 'react'
import type { CustomerDetail, OpportunityRow } from '@/services/crm'
import { listOpportunities } from '@/services/crm'
import { OPPORTUNITY_STAGES, statusOf } from '@/modules/crm/domain/statuses'

const money = (cents: number | null) => cents === null ? '-' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(cents / 100)
const closeDate = (value: string | null) => !value ? '-' : dayjs(value).year() === dayjs().year() ? dayjs(value).format('MM-DD') : dayjs(value).format('YYYY-MM-DD')

export default function OpportunitiesTab({ customer, refreshKey, createAction, onOpportunityClick }: { customer: CustomerDetail; refreshKey: number; createAction?: React.ReactNode; onOpportunityClick?: (id: number) => void }) {
  const [rows, setRows] = useState<OpportunityRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { setLoading(true); void listOpportunities({ customerId: customer.id, page: 1, pageSize: 100 }).then((result) => setRows(result.data)).finally(() => setLoading(false)) }, [customer.id, refreshKey])
  const summary = useMemo(() => { const active = rows.filter((row) => row.stage !== 'won' && row.stage !== 'lost'); const today = dayjs().startOf('day'); const deadline = dayjs().add(30, 'day').endOf('day'); return { activeCount: active.length, total: active.reduce((sum, row) => sum + (row.amountCents ?? 0), 0), next30: active.filter((row) => row.expectedCloseDate && !dayjs(row.expectedCloseDate).isBefore(today) && dayjs(row.expectedCloseDate).isBefore(deadline)).reduce((sum, row) => sum + (row.amountCents ?? 0), 0) } }, [rows])
  const columns: ProColumns<OpportunityRow>[] = [
    { title: '商机名称', dataIndex: 'name', width: 210, render: (_, row) => <a onClick={() => onOpportunityClick?.(row.id)}>{row.name}</a> },
    { title: '销售阶段', dataIndex: 'stage', width: 110, render: (_, row) => { const stage = statusOf(row.stage, OPPORTUNITY_STAGES); return <Tag color={stage.semantic === 'default' ? undefined : stage.semantic}>{stage.label}</Tag> } },
    { title: '赢单概率', dataIndex: 'stage', width: 92, render: (_, row) => `${statusOf(row.stage, OPPORTUNITY_STAGES).probability ?? 0}%` },
    { title: '预计金额', dataIndex: 'amountCents', width: 125, align: 'right', render: (_, row) => <span style={{ fontWeight: 500 }}>{money(row.amountCents)}</span> },
    { title: '预计成交', dataIndex: 'expectedCloseDate', width: 110, render: (_, row) => closeDate(row.expectedCloseDate) },
    { title: '负责人', dataIndex: 'ownerName', width: 120, renderText: (value) => value || '-' },
    { title: '下一步', dataIndex: 'nextAction', ellipsis: true, render: (_, row) => row.nextAction ? <Tooltip title={row.nextAction}>{row.nextAction}</Tooltip> : '-' },
  ]
  return <><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginBottom: rows.length ? 8 : 0 }}><div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 16, fontWeight: 600 }}>商机</span><span style={{ fontSize: 13, color: '#8c8c8c' }}>{rows.length}</span></div>{createAction}</div>{loading ? <Skeleton active paragraph={{ rows: 4 }} /> : rows.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><div>暂无商机</div><div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 4 }}>客户明确采购需求后，可以创建商机持续推进。</div></>} style={{ height: 250, paddingTop: 62, margin: 0 }} /> : <><div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 24, color: '#8c8c8c', fontSize: 13 }}><span>有效商机 <b style={{ color: '#262626', fontWeight: 500 }}>{summary.activeCount}</b></span><span>预计金额 <b style={{ color: '#262626', fontWeight: 500 }}>{money(summary.total)}</b></span><span>未来30天预计成交 <b style={{ color: '#262626', fontWeight: 500 }}>{money(summary.next30)}</b></span></div><ProTable<OpportunityRow> rowKey="id" columns={columns} dataSource={rows} search={false} pagination={false} options={false} toolBarRender={false} cardBordered={false} scroll={{ x: 900 }} size="small" /></>}</>
}
