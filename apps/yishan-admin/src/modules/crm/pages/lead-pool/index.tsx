/**
 * 线索公海列表页。
 *
 * 仅展示 `ownerUserId IS NULL` 的线索。所有用户可查看、领取；主管和管理员
 * 还可将公海线索直接分配给负责人。详情沿用 LeadDetailDrawer，它会在公海
 * owner 为空时隐藏写跟进入口。
 * 时间列也走 formatDateTime，避免 Invalid Date。
 */

import { type ActionType, PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { message, Popconfirm, Space, Tag } from 'antd'
import { useModel } from '@umijs/max'
import React, { useRef, useState } from 'react'
import { claimLead, listLeads, type LeadRow } from '@/services/crm'
import { formatDateTime, isOverdue } from '@/utils/formatDate'
import LeadDetailDrawer from '../leads/LeadDetailDrawer'
import { type LeadDetailState, closeLeadDetail, openLeadDetail } from '../leads/leadDetailState'
import TransferLeadDialog from '../leads/TransferLeadDialog'
import { canAssignPoolLead } from './leadPoolAccess'

const renderNextFollowUp = (value: LeadRow['nextFollowUpAt']) => {
  const text = formatDateTime(value)
  if (text === '—') return <span style={{ color: '#bfbfbf' }}>—</span>
  if (isOverdue(value)) {
    return (
      <Space size={4}>
        <span>{text}</span>
        <Tag color="red">逾期</Tag>
      </Space>
    )
  }
  return <span>{text}</span>
}

const columns: ProColumns<LeadRow>[] = [
  { title: '联系人', dataIndex: 'name', width: 120, renderText: (v) => v || '—' },
  { title: '公司名称', dataIndex: 'companyName', width: 180, renderText: (v) => v || '—' },
  { title: '手机号', dataIndex: 'mobile', width: 130, search: false, renderText: (v) => v || '—' },
  { title: '线索来源', dataIndex: 'sourceId', width: 100, search: false, renderText: (v) => v || '—' },
  {
    title: '下次跟进',
    dataIndex: 'nextFollowUpAt',
    width: 200,
    search: false,
    render: (_, r) => renderNextFollowUp(r.nextFollowUpAt),
  },
  { title: '创建时间', dataIndex: 'createdAt', width: 170, search: false, valueType: 'dateTime' },
]

export default function LeadPoolPage() {
  const actionRef = useRef<ActionType | undefined>(undefined)
  const { initialState } = useModel('@@initialState')
  const [detailLead, setDetailLead] = useState<LeadDetailState>(null)
  const [assignmentTarget, setAssignmentTarget] = useState<LeadDetailState>(null)
  const canAssign = canAssignPoolLead(initialState?.currentUser?.roleCodes)

  const handleClaim = async (row: LeadRow) => {
    try {
      await claimLead(row.id)
      message.success('线索领取成功，请在「线索」列表中继续跟进')
      setDetailLead(closeLeadDetail())
      actionRef.current?.reload()
    } catch (err: any) {
      message.error(err?.message ?? '领取失败')
    }
  }
  const poolColumns: ProColumns<LeadRow>[] = [
    ...columns,
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 200,
      render: (_, row) => (
        <Space size={16}>
          <a onClick={() => setDetailLead(openLeadDetail(row))}>查看</a>
          <Popconfirm
            key="claim"
            title={
              <span>
                领取
                <strong style={{ marginLeft: 4 }}>
                  {row.name || row.companyName || `线索 #${row.id}`}
                </strong>
                ？
              </span>
            }
            description="领取后线索归您所有，请尽快首次跟进。"
            okText="领取"
            cancelText="取消"
            onConfirm={() => handleClaim(row)}
          >
            <a>领取</a>
          </Popconfirm>
          {canAssign && (
            <a onClick={() => setAssignmentTarget(openLeadDetail(row))}>分配</a>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer header={{ title: '线索公海' }}>
      <ProTable<LeadRow>
        rowKey="id"
        actionRef={actionRef}
        headerTitle="线索池"
        columns={poolColumns}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as Record<string, unknown>
          const result = await listLeads({
            page: (current as number) ?? 1,
            pageSize: (pageSize as number) ?? 10,
            keyword: (rest.keyword as string) ?? '',
            pool: true,
          })
          return { data: result.data, success: true, total: result.total }
        }}
      />

      <TransferLeadDialog
        open={Boolean(assignmentTarget)}
        onOpenChange={(open) => {
          if (!open) setAssignmentTarget(closeLeadDetail())
        }}
        lead={assignmentTarget}
        mode="assign"
        onTransferred={() => {
          setAssignmentTarget(closeLeadDetail())
          setDetailLead(closeLeadDetail())
          actionRef.current?.reload()
        }}
      />

      <LeadDetailDrawer
        lead={detailLead}
        onClose={() => setDetailLead(closeLeadDetail())}
        onConvert={() => undefined}
        onOpenCustomer={() => undefined}
        onTransfer={() => undefined}
        onReturnToPool={() => undefined}
        showActions={false}
      />
    </PageContainer>
  )
}
