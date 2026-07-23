/**
 * 商城分类 — 完整 CRUD 演示页。
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
  deleteShopV1CategoriesId,
  getShopV1Categories,
  patchShopV1CategoriesId,
  postShopV1Categories,
} from '@/services/generated/shop'

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
  parentId?: number | null
  coverImage?: string
  icon?: string
  description?: string
  sortOrder?: number
  status?: Status
}

const Categories: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async () => {
    const res = await getShopV1Categories({})
    // generated service 返回业务响应（data 字段已是列表）
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
        parentId: values.parentId ?? null,
        coverImage: values.coverImage?.trim() ?? '',
        icon: values.icon?.trim() ?? '',
        description: values.description?.trim() ?? '',
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
        parentId: values.parentId ?? null,
        coverImage: values.coverImage?.trim() ?? '',
        icon: values.icon?.trim() ?? '',
        description: values.description?.trim() ?? '',
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

  const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({
    value: Number(value),
    label,
  }))

  const columns: ProColumns<Category>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: '名称', dataIndex: 'name', width: 220, fieldProps: { placeholder: '按名称筛选' } },
    {
      title: '父分类',
      dataIndex: 'parentId',
      width: 100,
      search: false,
      render: (_, record) => (record.parentId == null ? '-' : record.parentId),
    },
    {
      title: '图标',
      dataIndex: 'icon',
      width: 120,
      search: false,
      ellipsis: true,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 80,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      fieldProps: { options: statusOptions },
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
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
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
        subTitle: '商城商品分类管理',
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
            通过 openapi 生成的 services 调用 <code>shop/v1/categories</code> 五个端点；
            类型与字段与 <code>apps/yishan-api/src/modules/shop/schemas/categories.schema.ts</code> 同步。
          </Paragraph>
          <ProTable<Category>
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
        <ProFormText name="name" label="名称" rules={[{ required: true, max: 100 }]} />
        <ProFormDigit name="parentId" label="父分类 ID" min={0} />
        <ProFormText name="coverImage" label="封面图" fieldProps={{ maxLength: 500 }} />
        <ProFormText name="icon" label="图标" fieldProps={{ maxLength: 100 }} />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 500, rows: 3, showCount: true }}
        />
        <ProFormDigit name="sortOrder" label="排序" min={0} initialValue={0} />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={1}
          options={statusOptions}
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
                parentId: editing.parentId ?? undefined,
                coverImage: editing.coverImage ?? '',
                icon: editing.icon ?? '',
                description: editing.description ?? '',
                sortOrder: editing.sortOrder,
                status: editing.status as Status,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="name" label="名称" rules={[{ required: true, max: 100 }]} />
        <ProFormDigit name="parentId" label="父分类 ID" min={0} />
        <ProFormText name="coverImage" label="封面图" fieldProps={{ maxLength: 500 }} />
        <ProFormText name="icon" label="图标" fieldProps={{ maxLength: 100 }} />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 500, rows: 3, showCount: true }}
        />
        <ProFormDigit name="sortOrder" label="排序" min={0} />
        <ProFormSelect name="status" label="状态" options={statusOptions} />
      </ModalForm>
    </PageContainer>
  )
}

export default Categories
