/**
 * Portal 页面模板管理页面
 *
 * 功能：页面模板列表查询、创建、编辑、删除
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
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Tag, Tooltip } from 'antd'
import React, { useRef, useState } from 'react'
import {
  deletePortalV1PageTemplatesId,
  getPortalV1PageTemplates,
  patchPortalV1PageTemplatesId,
  postPortalV1PageTemplates,
} from '@/services/generated/portal'

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

const PageTemplateList: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [formValues, setFormValues] = useState<Partial<FormValues>>({
    status: 1,
    isSystemDefault: false,
  })

  const handleSuccess = () => {
    setFormVisible(false)
    setEditingId(undefined)
    setFormValues({ status: 1, isSystemDefault: false })
    actionRef.current?.reload()
  }

  const handleEdit = (record: Template) => {
    setEditingId(record.id)
    setFormValues({
      name: record.name,
      description: record.description ?? undefined,
      status: record.status as Status,
      isSystemDefault: record.isSystemDefault,
    })
    setFormVisible(true)
  }

  const handleRemove = async (id: number) => {
    await deletePortalV1PageTemplatesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Template>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
      width: 64,
    },
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 160,
    },
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
      width: 80,
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
      search: false,
      width: 80,
      render: (_, record) =>
        record.isSystemDefault ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
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
      render: (_, record) => {
        const deleteBtn = (
          <Button type="link" danger disabled={record.isSystemDefault}>
            删除
          </Button>
        )
        return [
          <Button key="edit" type="link" onClick={() => handleEdit(record)}>
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
              onConfirm={() => handleRemove(record.id)}
            >
              {deleteBtn}
            </Popconfirm>
          ),
        ]
      },
    },
  ]

  return (
    <PageContainer>
      <ProTable<Template>
        headerTitle="页面模板列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 100,
          defaultCollapsed: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(undefined)
              setFormValues({ status: 1, isSystemDefault: false })
              setFormVisible(true)
            }}
          >
            新建模板
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params
          const result = await getPortalV1PageTemplates({
            page: Number(current ?? 1),
            pageSize: Number(pageSize ?? 10),
            keyword: (restParams.keyword as string) || undefined,
            type: 1,
            status:
              restParams.status !== undefined
                ? Number(restParams.status)
                : undefined,
          })
          const data = (result as unknown as ListResp) ?? null
          return {
            data: data?.items ?? [],
            success: true,
            total: data?.total ?? 0,
          }
        }}
        columns={columns}
        scroll={{ x: 1000 }}
      />

      <ModalForm<FormValues>
        title={editingId ? '编辑模板' : '新建模板'}
        open={formVisible}
        onOpenChange={setFormVisible}
        layout="horizontal"
        labelCol={{ span: 4 }}
        initialValues={formValues}
        onFinish={async (values) => {
          if (editingId) {
            await patchPortalV1PageTemplatesId(
              { id: editingId },
              {
                name: values.name.trim(),
                description: values.description?.trim() ?? '',
                type: 1,
                status: values.status ?? 1,
                isSystemDefault: values.isSystemDefault ?? false,
              },
              {},
            )
            message.success('已更新')
          } else {
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
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="模板描述"
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

export default PageTemplateList