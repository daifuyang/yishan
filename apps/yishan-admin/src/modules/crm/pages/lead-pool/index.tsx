/**
 * 线索公海列表页。
 *
 * 仅展示 `ownerUserId IS NULL` 的线索。所有用户可查看、领取；主管和管理员
 * 还可将公海线索直接分配给负责人。详情沿用 LeadDetailDrawer，它会在公海
 * owner 为空时隐藏写跟进入口。
 * 时间列也走 formatDateTime，避免 Invalid Date。
 */

import { type ActionType, PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components'
import { PlusOutlined } from '@ant-design/icons'
import { Button, message, Modal, Popconfirm, Space, Tag } from 'antd'
import { useModel } from '@umijs/max'
import React, { useRef, useState } from 'react'
import { claimLead, createPoolLead, deleteLead, listLeads, type LeadRow } from '@/services/crm'
import { formatDateTime, isOverdue } from '@/utils/formatDate'
import LeadDetailDrawer from '../leads/LeadDetailDrawer'
import { type LeadDetailState, closeLeadDetail, openLeadDetail } from '../leads/leadDetailState'
import TransferLeadDialog from '../leads/TransferLeadDialog'
import { canAssignPoolLead } from './leadPoolAccess'
import CreatePoolLeadDialog from './CreatePoolLeadDialog'
import LeadImportDialog from './LeadImportDialog'
import { parseLeadImportFile } from './leadImport'

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
  {
    title: '线索来源',
    dataIndex: 'sourceName',
    width: 120,
    search: false,
    renderText: (v: string | null, record: LeadRow) =>
      v || (record.sourceId ? `来源 #${record.sourceId}` : '—'),
  },
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
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
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
  const handleDelete = async (row: LeadRow) => {
    try {
      await deleteLead(row.id)
      message.success('线索已删除')
      setDetailLead(closeLeadDetail())
      actionRef.current?.reload()
    } catch (err: any) {
      message.error(err?.message ?? '删除失败')
    }
  }
  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const parsed = await parseLeadImportFile(file)
      const failures = [...parsed.errors.map((item) => `第 ${item.row} 行：${item.message}`)]
      let succeeded = 0
      for (const item of parsed.rows) {
        try {
          await createPoolLead(item)
          succeeded += 1
        } catch (error: any) {
          failures.push(`${item.name || item.companyName || '未命名线索'}：${error?.message ?? '加入线索池失败'}`)
        }
      }
      if (succeeded) {
        message.success(`已导入 ${succeeded} 条线索到线索池`)
        actionRef.current?.reload()
        setImportOpen(false)
      }
      if (failures.length) {
        Modal.warning({
          title: succeeded ? '部分线索未导入' : '线索导入失败',
          content: <div>{failures.slice(0, 10).map((item) => <div key={item}>{item}</div>)}{failures.length > 10 && <div>其余 {failures.length - 10} 条请修正后重新导入。</div>}</div>,
        })
      }
    } catch (error: any) {
      message.error(error?.message ?? '读取导入文件失败')
    } finally {
      setImporting(false)
    }
    return false
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
        toolBarRender={() => [
          <Button key="import" onClick={() => setImportOpen(true)}>批量导入</Button>,
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新增线索</Button>,
        ]}
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

      <CreatePoolLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => actionRef.current?.reload()}
      />

      <LeadImportDialog
        open={importOpen}
        importing={importing}
        onOpenChange={setImportOpen}
        onImport={handleImport}
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
        onClaim={(row) => handleClaim(row)}
        onAssign={(row) => setAssignmentTarget(openLeadDetail(row))}
        onEditLead={(row) => message.info('公海线索需先领取再编辑')}
        onPrint={() => message.info('打印功能未接入')}
        onDelete={(row) => handleDelete(row)}
      />
    </PageContainer>
  )
}
