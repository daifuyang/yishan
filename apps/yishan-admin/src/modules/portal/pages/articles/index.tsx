import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1ArticlesId,
  getPortalV1Articles,
  getPortalV1ArticlesId,
  patchPortalV1ArticlesId,
  postPortalV1Articles,
  postPortalV1ArticlesIdPublish,
} from '@/services/generated/portal'

const { Title, Paragraph } = Typography

type Status = 0 | 1
const STATUS_LABEL: Record<Status, string> = {
  0: '草稿',
  1: '已发布',
}
const STATUS_COLOR: Record<Status, string> = {
  0: 'default',
  1: 'success',
}

interface Article {
  id: number
  title: string
  slug: string | null
  summary: string | null
  content: string
  coverImage: string | null
  status: number
  isPinned: boolean
  publishTime: string | null
  templateId: number | null
  categoryIds?: number[]
  createdAt: string
  updatedAt: string
}

interface ListResp {
  total: number
  items: Article[]
}

interface FormValues {
  title: string
  slug?: string
  summary?: string
  content: string
  coverImage?: string
  status?: Status
  isPinned?: boolean
  publishTime?: string
  templateId?: number
}

interface ListParams {
  current?: number
  pageSize?: number
  keyword?: string
  status?: Status
}

const Articles: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Article | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async (params: ListParams) => {
    const res = await getPortalV1Articles({
      page: params.current ?? 1,
      pageSize: params.pageSize ?? 10,
      keyword: params.keyword,
      status: params.status,
    })
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: FormValues) => {
    await postPortalV1Articles(
      {
        title: values.title.trim(),
        slug: values.slug?.trim() || undefined,
        summary: values.summary?.trim() || undefined,
        content: values.content.trim(),
        coverImage: values.coverImage?.trim() || undefined,
        status: values.status ?? 0,
        isPinned: values.isPinned ?? false,
        publishTime: values.publishTime,
        templateId: values.templateId,
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: FormValues) => {
    if (!editing) return
    await patchPortalV1ArticlesId(
      { id: editing.id },
      {
        title: values.title.trim(),
        slug: values.slug?.trim() || undefined,
        summary: values.summary?.trim() || undefined,
        content: values.content.trim(),
        coverImage: values.coverImage?.trim() || undefined,
        status: values.status ?? 0,
        isPinned: values.isPinned ?? false,
        publishTime: values.publishTime,
        templateId: values.templateId,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleEdit = async (id: number) => {
    const article = await getPortalV1ArticlesId({ id })
    setEditing(article)
  }

  const handleDelete = async (id: number) => {
    await deletePortalV1ArticlesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const handlePublish = async (id: number) => {
    await postPortalV1ArticlesIdPublish({ id }, {})
    message.success('已发布')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Article>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: '关键词', dataIndex: 'keyword', hideInTable: true },
    { title: '标题', dataIndex: 'title', width: 220, search: false },
    { title: '摘要', dataIndex: 'summary', search: false, ellipsis: true },
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
      title: '置顶',
      dataIndex: 'isPinned',
      width: 80,
      search: false,
      render: (_, record) => (record.isPinned ? '是' : '否'),
    },
    {
      title: '发布时间',
      dataIndex: 'publishTime',
      width: 180,
      search: false,
      valueType: 'dateTime',
      render: (_, record) =>
        record.publishTime ? new Date(record.publishTime).toLocaleString() : '-',
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
      width: 240,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => handleEdit(record.id)}>
          编辑
        </Button>,
        ...(record.status === 0
          ? [
              <Button key="publish" type="link" onClick={() => handlePublish(record.id)}>
                发布
              </Button>,
            ]
          : []),
        <Popconfirm
          key="del"
          title="确定删除该文章？"
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
        title: '文章管理',
        subTitle: '门户文章 CRUD + 发布',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建文章
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            文章列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理门户文章，支持新建、编辑、删除与发布。
          </Paragraph>
          <ProTable<Article>
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
        title="新建文章"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true, max: 200 }]} />
        <ProFormText name="slug" label="Slug" fieldProps={{ maxLength: 200 }} />
        <ProFormTextArea name="summary" label="摘要" fieldProps={{ maxLength: 500, rows: 3 }} />
        <ProFormTextArea name="content" label="内容" rules={[{ required: true }]} fieldProps={{ rows: 8 }} />
        <ProFormText name="coverImage" label="封面图片" fieldProps={{ maxLength: 500 }} />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={0}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormSwitch name="isPinned" label="置顶" initialValue={false} />
        <ProFormDateTimePicker name="publishTime" label="发布时间" />
        <ProFormDigit name="templateId" label="模板 ID" min={1} fieldProps={{ precision: 0 }} />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑文章 #${editing.id}` : '编辑文章'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                title: editing.title,
                slug: editing.slug,
                summary: editing.summary,
                content: editing.content,
                coverImage: editing.coverImage,
                status: editing.status as Status,
                isPinned: editing.isPinned,
                publishTime: editing.publishTime,
                templateId: editing.templateId,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true, max: 200 }]} />
        <ProFormText name="slug" label="Slug" fieldProps={{ maxLength: 200 }} />
        <ProFormTextArea name="summary" label="摘要" fieldProps={{ maxLength: 500, rows: 3 }} />
        <ProFormTextArea name="content" label="内容" rules={[{ required: true }]} fieldProps={{ rows: 8 }} />
        <ProFormText name="coverImage" label="封面图片" fieldProps={{ maxLength: 500 }} />
        <ProFormSelect
          name="status"
          label="状态"
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormSwitch name="isPinned" label="置顶" />
        <ProFormDateTimePicker name="publishTime" label="发布时间" />
        <ProFormDigit name="templateId" label="模板 ID" min={1} fieldProps={{ precision: 0 }} />
      </ModalForm>
    </PageContainer>
  )
}

export default Articles
