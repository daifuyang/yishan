import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDateTimePicker,
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
  deletePortalV1PagesId,
  getPortalV1Pages,
  patchPortalV1PagesId,
  postPortalV1Pages,
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
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}))

interface PortalPage {
  id: number
  title: string
  path: string
  content: string
  status: number
  publishTime: string | null
  templateId: number | null
  createdAt: string
  updatedAt: string
}

interface ListResp {
  total: number
  items: PortalPage[]
}

interface ListParams {
  current?: number
  pageSize?: number
  keyword?: string
  status?: number
}

interface FormValues {
  title: string
  path: string
  content: string
  status?: Status
  publishTime?: string
  templateId?: number
}

const Pages: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<PortalPage | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async (params: ListParams) => {
    const res = await getPortalV1Pages({
      page: params.current ?? 1,
      pageSize: params.pageSize ?? 10,
      keyword: params.keyword?.trim() || undefined,
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
    await postPortalV1Pages(
      {
        title: values.title.trim(),
        path: values.path.trim(),
        content: values.content,
        status: values.status ?? 0,
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
    await patchPortalV1PagesId(
      { id: editing.id },
      {
        title: values.title.trim(),
        path: values.path.trim(),
        content: values.content,
        status: values.status ?? 0,
        publishTime: values.publishTime,
        templateId: values.templateId,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deletePortalV1PagesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<PortalPage>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '搜索标题或路径' },
    },
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: '标题', dataIndex: 'title', width: 220, search: false },
    {
      title: '路径',
      dataIndex: 'path',
      width: 220,
      search: false,
      copyable: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      fieldProps: { options: STATUS_OPTIONS },
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status as Status]}>
          {STATUS_LABEL[record.status as Status]}
        </Tag>
      ),
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
      width: 200,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="del"
          title="确定删除该页面？"
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
        title: '页面管理',
        subTitle: '门户单页管理（about / contact 等静态页）',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建页面
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            页面列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            管理门户网站的 about、contact 等静态页面。
          </Paragraph>
          <ProTable<PortalPage>
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
        title="新建页面"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true, max: 200 }]} />
        <ProFormText
          name="path"
          label="路径"
          placeholder="/about"
          rules={[{ required: true, max: 255 }]}
        />
        <ProFormTextArea
          name="content"
          label="内容"
          rules={[{ required: true }]}
          fieldProps={{ rows: 8 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={0}
          options={STATUS_OPTIONS}
        />
        <ProFormDateTimePicker name="publishTime" label="发布时间" />
        <ProFormDigit name="templateId" label="模板 ID" min={1} fieldProps={{ precision: 0 }} />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑页面 #${editing.id}` : '编辑页面'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                title: editing.title,
                path: editing.path,
                content: editing.content,
                status: editing.status as Status,
                publishTime: editing.publishTime,
                templateId: editing.templateId ?? undefined,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true, max: 200 }]} />
        <ProFormText
          name="path"
          label="路径"
          placeholder="/about"
          rules={[{ required: true, max: 255 }]}
        />
        <ProFormTextArea
          name="content"
          label="内容"
          rules={[{ required: true }]}
          fieldProps={{ rows: 8 }}
        />
        <ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} />
        <ProFormDateTimePicker name="publishTime" label="发布时间" />
        <ProFormDigit name="templateId" label="模板 ID" min={1} fieldProps={{ precision: 0 }} />
      </ModalForm>
    </PageContainer>
  )
}

export default Pages
