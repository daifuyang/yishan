/**
 * 商城分类 — 完整 CRUD 演示页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 */
import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag } from 'antd'
import React, { useRef, useState } from 'react'
import {
  deleteShopV1CategoriesId,
  getShopV1Categories,
  patchShopV1CategoriesId,
  postShopV1Categories,
} from '@/services/generated/shop'

type Status = 0 | 1

interface Category {
  id: number
  name: string
  parentId: number | null
  coverImage: string | null
  icon: string | null
  description: string | null
  sortOrder: number
  status: number
  createdAt: string
  updatedAt: string
}

interface ListResp {
  total: number
  items: Category[]
}

interface FormValues {
  name: string
  sortOrder?: number
  status?: Status
}

const STATUS_VALUE_ENUM: Record<string, { text: string; status: string }> = {
  0: { text: '禁用', status: 'Default' },
  1: { text: '启用', status: 'Success' },
}

const Categories: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editing, setEditing] = useState<Category | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async () => {
    const res = await getShopV1Categories({})
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: FormValues) => {
    await postShopV1Categories(
      {
        name: values.name.trim(),
        sortOrder: values.sortOrder ?? 0,
        status: values.status ?? 1,
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: FormValues) => {
    if (!editing) return
    await patchShopV1CategoriesId(
      { id: editing.id },
      {
        name: values.name.trim(),
        sortOrder: values.sortOrder ?? 0,
        status: values.status ?? 1,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1CategoriesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Category>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    { title: '分类名称', dataIndex: 'name', width: 160 },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 64,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueType: 'select',
      valueEnum: STATUS_VALUE_ENUM,
      render: (_, record) => (
        <Tag color={record.status === 1 ? 'success' : 'default'}>
          {record.status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => setEditing(record)}>编辑</a>
          <Popconfirm
            title="确定要删除该分类吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<Category>
        headerTitle="分类列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={fetchList}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 900 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建分类
          </Button>,
        ]}
      />

      <ModalForm<FormValues>
        title="新建分类"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        width={640}
        layout="horizontal"
        labelCol={{ span: 4 }}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="分类名称"
          placeholder="请输入分类名称"
          rules={[{ required: true, message: '请输入分类名称' }]}
        />
        <ProFormDigit
          name="sortOrder"
          label="排序"
          placeholder="排序序号"
          min={0}
          initialValue={0}
        />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={1}
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑分类 #${editing.id}` : '编辑分类'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                name: editing.name,
                sortOrder: editing.sortOrder,
                status: editing.status as Status,
              }
            : undefined
        }
        width={640}
        layout="horizontal"
        labelCol={{ span: 4 }}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="分类名称"
          placeholder="请输入分类名称"
          rules={[{ required: true, message: '请输入分类名称' }]}
        />
        <ProFormDigit
          name="sortOrder"
          label="排序"
          placeholder="排序序号"
          min={0}
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 1 },
            { label: '禁用', value: 0 },
          ]}
        />
      </ModalForm>
    </PageContainer>
  )
}

export default Categories