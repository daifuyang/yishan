/**
 * CRM 联系人独立列表页。
 */

import {
  type ActionType,
  DrawerForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space } from 'antd'
import React, { useRef, useState } from 'react'
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type ContactCreateInput,
  type ContactRow,
} from '@/services/crm'

const Contacts: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContactRow | null>(null)

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await updateContact(editing.id, values)
        message.success('已更新')
      } else {
        await createContact(values)
        message.success('已创建')
      }
      setOpen(false)
      setEditing(null)
      actionRef.current?.reload()
      return true
    } catch (err: any) {
      message.error(err?.message ?? '操作失败')
      return false
    }
  }

  const handleDelete = async (id: number) => {
    await deleteContact(id)
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<ContactRow>[] = [
    { title: '姓名', dataIndex: 'name', width: 140 },
    {
      title: '所属客户',
      dataIndex: 'customerId',
      width: 120,
      render: (_, r) => `#${r.customerId}`,
    },
    {
      title: '手机',
      dataIndex: 'mobile',
      width: 140,
    },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '职位', dataIndex: 'position', width: 120 },
    {
      title: '主联系人',
      dataIndex: 'isPrimary',
      width: 100,
      valueEnum: {
        0: { text: '否' },
        1: { text: '是', status: 'Success' },
      },
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
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <a onClick={() => { setEditing(record); setOpen(true) }}>编辑</a>
          <Popconfirm
            title={`确认删除「${record.name}」？`}
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer header={{ title: '联系人' }}>
      <ProTable<ContactRow>
        headerTitle="联系人列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as Record<string, unknown>
          const res = await listContacts({
            page: (current as number) ?? 1,
            pageSize: (pageSize as number) ?? 10,
            keyword: (rest.keyword as string) ?? '',
            customerId: rest.customerId ? Number(rest.customerId) : undefined,
          })
          return {
            data: res.data,
            success: true,
            total: res.total,
          }
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            新建联系人
          </Button>,
        ]}
      />

      <DrawerForm<ContactCreateInput>
        title={editing ? '编辑联系人' : '新建联系人'}
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setEditing(null)
        }}
        onFinish={handleSubmit}
        initialValues={
          editing
            ? {
                customerId: editing.customerId,
                name: editing.name,
                gender: editing.gender,
                mobile: editing.mobile ?? undefined,
                phone: editing.phone ?? undefined,
                email: editing.email ?? undefined,
                department: editing.department ?? undefined,
                position: editing.position ?? undefined,
                isPrimary: editing.isPrimary,
              }
            : { customerId: undefined, gender: 0, isPrimary: 0 }
        }
        drawerProps={{ destroyOnClose: true, width: 520 }}
      >
        <ProFormDigit name="customerId" label="客户 ID" rules={[{ required: true }]} fieldProps={{ precision: 0 }} />
        <ProFormText name="name" label="姓名" rules={[{ required: true, max: 100 }]} />
        <ProFormSelect
          name="gender"
          label="性别"
          options={[
            { value: 0, label: '未知' },
            { value: 1, label: '男' },
            { value: 2, label: '女' },
          ]}
        />
        <ProFormText name="mobile" label="手机" />
        <ProFormText name="phone" label="电话" />
        <ProFormText name="email" label="邮箱" />
        <ProFormText name="department" label="部门" />
        <ProFormText name="position" label="职位" />
        <ProFormSelect
          name="isPrimary"
          label="是否主联系人"
          options={[
            { value: 0, label: '否' },
            { value: 1, label: '是' },
          ]}
        />
      </DrawerForm>
    </PageContainer>
  )
}

export default Contacts
