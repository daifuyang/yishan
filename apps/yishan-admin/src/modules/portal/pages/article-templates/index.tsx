/**
 * 文章模板 — 列表 / 创建 / 编辑 / 删除。
 *
 * 通过 openapi 生成的 services 调用后端 API。type 固定 0（文章模板），
 * 在 service handler 中设置，前端表单不暴露 type 字段。
 */
import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tooltip } from 'antd'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1ArticleTemplatesId,
  getPortalV1ArticleTemplates,
  patchPortalV1ArticleTemplatesId,
  postPortalV1ArticleTemplates,
} from '@/services/generated/portal'

type Status = 0 | 1
const STATUS_LABEL: Record<Status, string> = {
  0: '禁用',
  1: '启用',
}

interface Template {
  id: number
  name: string
  description: string | null
  status: number
  isSystemDefault: boolean
  createdAt: string
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

const ArticleTemplates: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  const fetchList = async (params: Record<string, unknown>) => {
    const res = await getPortalV1ArticleTemplates({
      page: Number(params.current ?? params.page ?? 1),
      pageSize: Number(params.pageSize ?? 10),
      keyword: (params.keyword as string) || undefined,
      type: 0,
      status: params.status !== undefined ? Number(params.status) : undefined,
    })
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleSuccess = () => {
    setFormVisible(false)
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleEdit = (record: Template) => {
    setEditing(record)
    setFormVisible(true)
  }

  const handleRemove = async (id: number) => {
    await deletePortalV1ArticleTemplatesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Template>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 64 },
    { title: '模板名称', dataIndex: 'name', width: 160 },
    {
      title: '描述',
      dataIndex: 'description',
      search: false,
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: Object.fromEntries(
        Object.entries(STATUS_LABEL).map(([value, label]) => [
          value,
          { text: label, status: label === '启用' ? 'Success' : 'Default' },
        ]),
      ),
      width: 80,
    },
    {
      title: '系统默认',
      dataIndex: 'isSystemDefault',
      search: false,
      width: 80,
      render: (_, record) => (record.isSystemDefault ? <span>是</span> : <span>否</span>),
    },
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
          <a onClick={() => handleEdit(record)}>编辑</a>
          {record.isSystemDefault ? (
            <Tooltip title="系统默认模板不可删除">
              <a style={{ color: '#ff4d4f', cursor: 'not-allowed' }}>删除</a>
            </Tooltip>
          ) : (
            <Popconfirm
              title="确定要删除该模板吗？"
              onConfirm={() => handleRemove(record.id)}
            >
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<Template>
        headerTitle="文章模板列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 100,
          defaultCollapsed: true,
        }}
        scroll={{ x: 900 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              setEditing(null)
              setFormVisible(true)
            }}
          >
            <PlusOutlined /> 新建文章模板
          </Button>,
        ]}
        request={fetchList}
        columns={columns}
      />

      <ModalForm<FormValues>
        title={editing ? '编辑文章模板' : '新建文章模板'}
        open={formVisible}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
          setFormVisible(open)
        }}
        layout="horizontal"
        labelCol={{ span: 4 }}
        width={720}
        initialValues={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? '',
                status: editing.status as Status,
                isSystemDefault: editing.isSystemDefault,
              }
            : { status: 1, isSystemDefault: false }
        }
        onFinish={async (values) => {
          if (editing) {
            await patchPortalV1ArticleTemplatesId(
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
          } else {
            await postPortalV1ArticleTemplates(
              {
                name: values.name.trim(),
                description: values.description?.trim() ?? '',
                type: 0,
                status: values.status ?? 1,
                isSystemDefault: values.isSystemDefault ?? false,
              },
              {},
            )
            message.success('已创建')
          }
          handleSuccess()
          return true
        }}
      >
        <ProFormText
          name="name"
          label="模板名称"
          placeholder="请输入模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        />
        <ProFormTextArea name="description" label="描述" placeholder="模板描述" />
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

export default ArticleTemplates
