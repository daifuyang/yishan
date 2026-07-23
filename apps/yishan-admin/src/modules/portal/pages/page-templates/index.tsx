/**
 * 页面模板 — 完整 CRUD 演示页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 * 后端固定 type=1（页面模板）。
 */
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1PageTemplatesId,
  getPortalV1PageTemplates,
  patchPortalV1PageTemplatesId,
  postPortalV1PageTemplates,
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

interface Template {
  id: number
  name: string
  description: string | null
  type: number
  schema?: any
  config?: any
  status: number
  isSystemDefault: boolean
  creatorId: number | null
  createdAt: string
  updaterId: number | null
  updatedAt: string
}

interface ListResp {
  total: number
  items: Template[]
}

interface FormValues {
  name: string
  description?: string
  status?: Status
  isSystemDefault?: boolean
}

const PageTemplates: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Template | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async (params: Record<string, unknown>) => {
    const res = await getPortalV1PageTemplates({
      page: Number(params.current ?? params.page ?? 1),
      pageSize: Number(params.pageSize ?? 10),
      keyword: (params.keyword as string) || undefined,
      type: 1,
      status: params.status !== undefined ? Number(params.status) : undefined,
    })
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: FormValues) => {
    await postPortalV1PageTemplates(
      {
        name: values.name.trim(),
        description: values.description?.trim() ?? '',
        type: 1,
        status: values.status ?? 1,
        isSystemDefault: values.isSystemDefault ?? false,
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: FormValues) => {
    if (!editing) return
    await patchPortalV1PageTemplatesId(
      { id: editing.id },
      {
        name: values.name.trim(),
        description: values.description?.trim() ?? '',
        status: values.status ?? 1,
        isSystemDefault: values.isSystemDefault ?? false,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deletePortalV1PageTemplatesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Template>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: '名称', dataIndex: 'name', width: 220 },
    { title: '描述', dataIndex: 'description', search: false, ellipsis: true },
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
      title: '系统默认',
      dataIndex: 'isSystemDefault',
      width: 100,
      search: false,
      render: (_, record) =>
        record.isSystemDefault ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
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
      render: (_, record) => {
        const deleteBtn = (
          <Button type="link" danger disabled={record.isSystemDefault}>
            删除
          </Button>
        )
        return [
          <Button key="edit" type="link" onClick={() => setEditing(record)}>
            编辑
          </Button>,
          record.isSystemDefault ? (
            <Tooltip key="del" title="系统默认模板不可删除">
              {deleteBtn}
            </Tooltip>
          ) : (
            <Popconfirm
              key="del"
              title="确定删除该模板？"
              okText="删除"
              cancelText="取消"
              onConfirm={() => handleDelete(record.id)}
            >
              {deleteBtn}
            </Popconfirm>
          ),
        ]
      },
    },
  ]

  return (
    <PageContainer
      header={{
        title: '页面模板',
        subTitle: '页面模板管理（type=1，页面专用模板）',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建页面模板
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            页面模板列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            通过 openapi 生成的 services 调用 <code>getPortalV1PageTemplates*</code> 端点；
            类型与字段与 <code>apps/yishan-api/src/modules/portal/schemas/templates.schema.ts</code> 同步。
          </Paragraph>
          <ProTable<Template>
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
        title="新建页面模板"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          rules={[{ required: true, max: 100 }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 255, rows: 3 }}
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
        <ProFormSwitch
          name="isSystemDefault"
          label="系统默认"
          initialValue={false}
        />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑页面模板 #${editing.id}` : '编辑页面模板'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? '',
                status: editing.status as Status,
                isSystemDefault: editing.isSystemDefault,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          rules={[{ required: true, max: 100 }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 255, rows: 3 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormSwitch name="isSystemDefault" label="系统默认" />
      </ModalForm>
    </PageContainer>
  )
}

export default PageTemplates
