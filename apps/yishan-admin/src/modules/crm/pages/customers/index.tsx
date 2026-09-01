/**
 * CRM 我的客户列表页（Ant Design Pro 标准 list）。
 *
 * 通过 @/services/crm 调后端 API（待 openapi 重新生成后可切到 generated）。
 */

import {
  type ActionType,
  DrawerForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Modal, Popconfirm, Space, Tag } from 'antd'
import React, { useRef, useState } from 'react'
import { history } from '@umijs/max'
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  releaseCustomer,
  transferCustomer,
  updateCustomer,
  type CustomerCreateInput,
  type CustomerDetail,
  type CustomerRow,
  type CustomerUpdateInput,
} from '@/services/crm'

const TYPE_OPTIONS = [
  { value: 'enterprise', label: '企业客户' },
  { value: 'individual', label: '个人客户' },
]

const Customers: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerDetail | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<{ id: number; name: string } | null>(null)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<{ id: number; name: string } | null>(null)

  const handleOpenCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleOpenEdit = async (id: number) => {
    // 简化：列表里直接编辑时只携带可编辑字段
    setEditing({ id, name: '', type: 'enterprise' } as CustomerDetail)
    setFormOpen(true)
  }

  const handleSubmit = async (
    values: CustomerCreateInput & { id?: number },
  ) => {
    try {
      if (values.id) {
        const { id, ...rest } = values
        await updateCustomer(id, rest as CustomerUpdateInput)
        message.success('已更新')
      } else {
        try {
          await createCustomer(values)
          message.success('已创建')
        } catch (err: any) {
          // 重复客户 → 弹出引导
          const code = err?.response?.data?.code ?? err?.code
          const details = err?.response?.data?.error ?? err?.details
          if (code === 33002 && details) {
            try {
              const dup = JSON.parse(details)
              Modal.confirm({
                title: '发现疑似重复客户',
                content: `${dup.existingCustomerName}（${dup.ownerUserName ?? '无人负责'}）`,
                okText: '查看客户',
                cancelText: '继续创建',
                onOk: () => {
                  history.push(`/crm/customer-detail?id=${dup.existingCustomerId}`)
                },
              })
              return false
            } catch {
              /* ignore */
            }
          }
          throw err
        }
      }
      setFormOpen(false)
      setEditing(null)
      actionRef.current?.reload()
      return true
    } catch (err: any) {
      message.error(err?.message ?? '操作失败')
      return false
    }
  }

  const handleDelete = async (id: number) => {
    await deleteCustomer(id)
    message.success('已删除')
    actionRef.current?.reload()
  }

  const handleTransfer = async (targetUserId: number, reason?: string) => {
    if (!transferTarget) return
    await transferCustomer(transferTarget.id, targetUserId, reason)
    message.success('客户已转交')
    setTransferOpen(false)
    setTransferTarget(null)
    actionRef.current?.reload()
  }

  const handleRelease = async (reason?: string) => {
    if (!releaseTarget) return
    await releaseCustomer(releaseTarget.id, reason)
    message.success('客户已释放到公海')
    setReleaseOpen(false)
    setReleaseTarget(null)
    actionRef.current?.reload()
  }

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 200,
      render: (_, r) => (
        <a onClick={() => history.push(`/crm/customer-detail?id=${r.id}`)}>{r.name}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      valueEnum: {
        enterprise: { text: '企业' },
        individual: { text: '个人' },
      },
    },
    {
      title: '电话',
      dataIndex: 'phone',
      width: 140,
      search: false,
      render: (_, r) => r.phone || '—',
    },
    {
      title: '状态',
      dataIndex: 'statusId',
      width: 100,
      render: (_, r) =>
        r.poolStatus === 'public' ? <Tag color="default">公海</Tag> : <Tag color="blue">已分配</Tag>,
    },
    {
      title: '最近跟进',
      dataIndex: 'lastFollowUpAt',
      width: 170,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '下次跟进',
      dataIndex: 'nextFollowUpAt',
      width: 170,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 220,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => history.push(`/crm/customer-detail?id=${record.id}`)}>查看</a>
          <a onClick={() => handleOpenEdit(record.id)}>编辑</a>
          <Popconfirm
            title={`确认删除「${record.name}」？`}
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
          {record.poolStatus === 'owned' && (
            <>
              <a
                onClick={() => {
                  setReleaseTarget({ id: record.id, name: record.name })
                  setReleaseOpen(true)
                }}
              >
                释放
              </a>
              <a
                onClick={() => {
                  setTransferTarget({ id: record.id, name: record.name })
                  setTransferOpen(true)
                }}
              >
                转交
              </a>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer
      header={{
        title: '客户管理',
        subTitle: '统一维护、分配和持续跟进客户资源。',
      }}
    >
      <ProTable<CustomerRow>
        headerTitle="我的客户"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as Record<string, unknown>
          const res = await listCustomers({
            page: (current as number) ?? 1,
            pageSize: (pageSize as number) ?? 10,
            keyword: (rest.keyword as string) ?? '',
            statusId: rest.statusId ? Number(rest.statusId) : undefined,
            sourceId: rest.sourceId ? Number(rest.sourceId) : undefined,
          })
          return {
            data: res.data,
            success: true,
            total: res.total,
          }
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={handleOpenCreate}>
            新建客户
          </Button>,
        ]}
      />

      <DrawerForm<CustomerCreateInput & { id?: number }>
        title={editing?.id ? '编辑客户' : '新建客户'}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        onFinish={async (values) => {
          const payload: CustomerCreateInput & { id?: number } = {
            ...values,
            type: values.type ?? 'enterprise',
          }
          if (editing?.id) payload.id = editing.id
          return handleSubmit(payload)
        }}
        initialValues={{
          type: 'enterprise',
        }}
        drawerProps={{ destroyOnClose: true, maskClosable: false, width: 720 }}
      >
        <ProFormText
          name="name"
          label="客户名称"
          rules={[{ required: true, max: 200 }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="type"
          label="客户类型"
          options={TYPE_OPTIONS}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="statusId"
          label="客户状态"
          colProps={{ span: 12 }}
          fieldProps={{ precision: 0 }}
        />
        <ProFormDigit
          name="sourceId"
          label="客户来源"
          colProps={{ span: 12 }}
          fieldProps={{ precision: 0 }}
        />
        <ProFormText name="level" label="客户等级" colProps={{ span: 12 }} />
        <ProFormText name="industry" label="行业" colProps={{ span: 12 }} />
        <ProFormText
          name="phone"
          label="联系电话"
          colProps={{ span: 12 }}
          rules={[{ max: 32 }]}
        />
        <ProFormText
          name="website"
          label="官网"
          colProps={{ span: 12 }}
          rules={[{ max: 200 }]}
        />
        <ProFormText name="province" label="省份" colProps={{ span: 12 }} />
        <ProFormText name="city" label="城市" colProps={{ span: 12 }} />
        <ProFormText
          name="address"
          label="详细地址"
          colProps={{ span: 24 }}
          rules={[{ max: 255 }]}
        />
        <ProFormDigit
          name="ownerUserId"
          label="负责人 ID"
          colProps={{ span: 12 }}
          fieldProps={{ precision: 0 }}
        />
        <ProFormDigit
          name="ownerDepartmentId"
          label="负责部门 ID"
          colProps={{ span: 12 }}
          fieldProps={{ precision: 0 }}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          colProps={{ span: 24 }}
          fieldProps={{ maxLength: 2000, rows: 3 }}
        />
      </DrawerForm>

      {/* 释放 */}
      <Modal
        title={releaseTarget ? `释放客户「${releaseTarget.name}」到公海` : '释放客户'}
        open={releaseOpen}
        onCancel={() => {
          setReleaseOpen(false)
          setReleaseTarget(null)
        }}
        onOk={async () => {
          const reason = (document.getElementById('crm-release-reason') as HTMLTextAreaElement)?.value
          await handleRelease(reason)
        }}
      >
        <p>释放后该客户将进入公海，其他销售可认领。</p>
        <textarea
          id="crm-release-reason"
          placeholder="释放原因（可选）"
          style={{ width: '100%', minHeight: 80, padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}
          maxLength={500}
        />
      </Modal>

      {/* 转交 */}
      <Modal
        title={transferTarget ? `转交客户「${transferTarget.name}」` : '转交客户'}
        open={transferOpen}
        onCancel={() => {
          setTransferOpen(false)
          setTransferTarget(null)
        }}
        onOk={async () => {
          const targetUserId = Number(
            (document.getElementById('crm-transfer-target') as HTMLInputElement)?.value,
          )
          const reason = (document.getElementById('crm-transfer-reason') as HTMLTextAreaElement)?.value
          if (!targetUserId || Number.isNaN(targetUserId)) {
            message.error('请输入目标用户 ID')
            return
          }
          await handleTransfer(targetUserId, reason)
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label>目标用户 ID</label>
          <input
            id="crm-transfer-target"
            type="number"
            placeholder="请输入目标用户 ID"
            style={{ width: '100%', padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}
          />
        </div>
        <div>
          <label>转交原因（可选）</label>
          <textarea
            id="crm-transfer-reason"
            placeholder="区域调整 / 客户类型变更..."
            style={{ width: '100%', minHeight: 80, padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}
            maxLength={500}
          />
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Customers
