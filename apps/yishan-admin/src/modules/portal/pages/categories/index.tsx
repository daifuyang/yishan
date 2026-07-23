/**
 * 门户分类管理 — 完整 CRUD 管理页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 */
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1CategoriesId,
  getPortalV1Categories,
  getPortalV1CategoriesId,
  patchPortalV1CategoriesId,
  postPortalV1Categories,
} from '@/services/generated/portal'

const { Title, Paragraph } = Typography

type Status = 0 | 1
const STATUS_LABEL: Record<Status, string> = {
  0: '禁用',
  1: '启用',
}
const STATUS_COLOR: Record<Status, string> = {
  0: 'default',
  1: 'success',
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

interface TableParams {
  current?: number
  pageSize?: number
  keyword?: string
  parentId?: number
  status?: Status
}

interface FormValues {
  name: string
  slug?: string
  parentId?: number | null
  status?: Status
  sortOrder?: number
  description?: string
}

const Categories: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async (params: TableParams) => {
    const res = await getPortalV1Categories({
      page: params.current ?? 1,
      pageSize: params.pageSize ?? 10,
      keyword: params.keyword?.trim() || undefined,
      parentId: params.parentId,
      status: params.status,
    })
    const data = (res as unknown as ServiceResp<ListResp>).data ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: FormValues) => {
    await postPortalV1Categories(
      {
        name: values.name.trim(),
        slug: values.slug?.trim(),
        parentId: values.parentId ?? null,
        status: values.status ?? 1,
        sortOrder: values.sortOrder ?? 0,
        description: values.description?.trim(),
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleEdit = async (id: number) => {
    const res = await getPortalV1CategoriesId({ id })
    const data = (res as unknown as ServiceResp<Category>).data
    setEditing(data)
  }

  const handleUpdate = async (values: FormValues) => {
    if (!editing) return
    await patchPortalV1CategoriesId(
      { id: editing.id },
      {
        name: values.name.trim(),
        slug: values.slug?.trim(),
        parentId: values.parentId ?? null,
        status: values.status ?? 1,
        sortOrder: values.sortOrder ?? 0,
        description: values.description?.trim(),
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deletePortalV1CategoriesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Category>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '名称',
      dataIndex: 'keyword',
      width: 200,
      render: (_, record) => record.name,
    },
    { title: 'Slug', dataIndex: 'slug', width: 180, search: false },
    {
      title: '父分类 ID',
      dataIndex: 'parentId',
      width: 120,
      search: false,
      render: (_, record) => record.parentId ?? '-',
    },
    { title: '排序', dataIndex: 'sortOrder', width: 100, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      fieldProps: {
        options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
          value: Number(value),
          label,
        })),
      },
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status as Status]}>
          {STATUS_LABEL[record.status as Status]}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => handleEdit(record.id)}>
          编辑
        </Button>,
        <Popconfirm
          key="del"
          title="确定删除该分类？"
          okText="删除"
          cancelText="取消"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <PageContainer
      header={{
        title: '分类管理',
        subTitle: '门户文章 / 页面分类管理',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建分类
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            分类列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            通过 openapi 生成的 services 管理门户文章与页面分类。
          </Paragraph>
          <ProTable<Category, TableParams>
            rowKey="id"
            actionRef={actionRef}
            columns={columns}
            request={fetchList}
            search={{ labelWidth: 'auto' }}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </ProCard>

      <ModalForm<FormValues>
        title="新建分类"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          fieldProps={{ maxLength: 100 }}
          rules={[{ required: true, whitespace: true, min: 1, max: 100 }]}
        />
        <ProFormText name="slug" label="Slug" fieldProps={{ maxLength: 100 }} rules={[{ max: 100 }]} />
        <ProFormDigit name="parentId" label="父分类 ID" fieldProps={{ precision: 0 }} />
        <ProFormDigit
          name="sortOrder"
          label="排序"
          initialValue={0}
          fieldProps={{ precision: 0 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={1}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 255, rows: 3 }}
          rules={[{ max: 255 }]}
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
                slug: editing.slug ?? undefined,
                parentId: editing.parentId,
                status: editing.status as Status,
                sortOrder: editing.sortOrder,
                description: editing.description ?? undefined,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          fieldProps={{ maxLength: 100 }}
          rules={[{ required: true, whitespace: true, min: 1, max: 100 }]}
        />
        <ProFormText name="slug" label="Slug" fieldProps={{ maxLength: 100 }} rules={[{ max: 100 }]} />
        <ProFormDigit name="parentId" label="父分类 ID" fieldProps={{ precision: 0 }} />
        <ProFormDigit name="sortOrder" label="排序" fieldProps={{ precision: 0 }} />
        <ProFormSelect
          name="status"
          label="状态"
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 255, rows: 3 }}
          rules={[{ max: 255 }]}
        />
      </ModalForm>
    </PageContainer>
  )
}

export default Categories
