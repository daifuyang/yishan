/**
 * 门户分类管理 — 完整 CRUD 管理页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 */
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormRadio,
  ProFormText,
  ProFormTextArea,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { PlusOutlined } from '@ant-design/icons'
import { Button, message, Popconfirm, Space } from 'antd'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1CategoriesId,
  getPortalV1Categories,
  getPortalV1CategoriesId,
  patchPortalV1CategoriesId,
  postPortalV1Categories,
} from '@/services/generated/portal'

const statusEnum: Record<string, { text: string; status: string }> = {
  '0': { text: '禁用', status: 'Error' },
  '1': { text: '启用', status: 'Success' },
}

interface Category {
  id: number
  name: string
  slug: string | null
  parentId: number | null
  status: number
  sortOrder: number
  description: string | null
  creatorId: number | null
  createdAt: string
  updaterId: number | null
  updatedAt: string
}

interface ListResp {
  total: number
  page: number
  pageSize: number
  items: Category[]
}

interface ServiceResp<T> {
  data: T
}

interface FormValues {
  name: string
  slug?: string
  parentId?: string | number | null
  status?: string
  sortOrder?: number
  description?: string
}

const Categories: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [formVisible, setFormVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [formValues, setFormValues] = useState<Partial<FormValues>>({
    status: '1',
    sortOrder: 0,
  })

  const handleSuccess = () => {
    setFormVisible(false)
    setEditingId(undefined)
    setFormValues({ status: '1', sortOrder: 0 })
    actionRef.current?.reload()
  }

  const handleEdit = async (id: number) => {
    const res = await getPortalV1CategoriesId({ id })
    const data = (res as unknown as ServiceResp<Category>).data
    if (data) {
      setFormValues({
        name: data.name,
        slug: data.slug ?? undefined,
        parentId: data.parentId ?? undefined,
        status: String(data.status),
        sortOrder: data.sortOrder,
        description: data.description ?? undefined,
      })
      setEditingId(id)
      setFormVisible(true)
    } else {
      message.error('获取分类详情失败')
    }
  }

  const handleRemove = async (id: number) => {
    await deletePortalV1CategoriesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Category>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 64 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: 'URL标识', dataIndex: 'slug', search: false, width: 140 },
    {
      title: '父级分类',
      dataIndex: 'parentId',
      search: false,
      width: 120,
      render: (_, record) => record.parentId ?? '-',
    },
    { title: '排序', dataIndex: 'sortOrder', search: false, width: 64 },
    { title: '状态', dataIndex: 'status', valueEnum: statusEnum, width: 80 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => handleEdit(record.id)}>编辑</a>
          <Popconfirm title="确定要删除该分类吗？" onConfirm={() => handleRemove(record.id)}>
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
        search={{ labelWidth: 100, defaultCollapsed: true }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              setEditingId(undefined)
              setFormValues({ status: '1', sortOrder: 0 })
              setFormVisible(true)
            }}
          >
            <PlusOutlined /> 新建分类
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, name, ...restParams } = params as Record<string, unknown>
          const statusValue = restParams.status as string | undefined
          const res = await getPortalV1Categories({
            page: (current as number) ?? 1,
            pageSize: (pageSize as number) ?? 10,
            keyword: typeof name === 'string' ? name.trim() || undefined : undefined,
            status: statusValue !== undefined ? Number(statusValue) : undefined,
          })
          const data = (res as unknown as ServiceResp<ListResp>).data ?? null
          return {
            data: data?.items ?? [],
            success: true,
            total: data?.total ?? 0,
          }
        }}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 1000 }}
      />

      <ModalForm<FormValues>
        title={editingId ? '编辑分类' : '新建分类'}
        open={formVisible}
        onOpenChange={setFormVisible}
        layout="horizontal"
        labelCol={{ span: 4 }}
        initialValues={formValues}
        onFinish={async (values) => {
          const parentId =
            values.parentId !== undefined && values.parentId !== '' && values.parentId !== null
              ? Number(values.parentId)
              : null
          const payload = {
            name: values.name.trim(),
            slug: values.slug?.trim() || undefined,
            parentId,
            status: values.status ? Number(values.status) : 1,
            sortOrder: values.sortOrder ?? 0,
            description: values.description?.trim() || undefined,
          }
          try {
            if (editingId) {
              await patchPortalV1CategoriesId({ id: editingId }, payload, {})
            } else {
              await postPortalV1Categories(payload, {})
            }
            message.success(editingId ? '已更新' : '已创建')
            handleSuccess()
            return true
          } catch {
            message.error('操作失败')
            return false
          }
        }}
      >
        <ProFormText
          name="name"
          label="分类名称"
          placeholder="请输入分类名称"
          rules={[{ required: true, message: '请输入分类名称' }]}
        />
        <ProFormText name="slug" label="URL标识" placeholder="URL友好标识" />
        <ProFormText
          name="parentId"
          label="父级分类ID"
          placeholder="父级分类ID（可选）"
        />
        <ProFormDigit name="sortOrder" label="排序序号" placeholder="排序序号" min={0} />
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={[
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' },
          ]}
        />
        <ProFormTextArea name="description" label="描述" placeholder="分类描述" />
      </ModalForm>
    </PageContainer>
  )
}

export default Categories
