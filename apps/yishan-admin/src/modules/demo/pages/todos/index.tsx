/**
 * Todo 示例 — 完整 CRUD 演示页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 */
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { PlusOutlined } from '@ant-design/icons'
import { Button, message, Popconfirm, Space } from 'antd'
import React, { useRef, useState } from 'react'
import {
  demoV1TodosCreate,
  demoV1TodosDelete,
  demoV1TodosList,
  demoV1TodosUpdate,
} from '@/services/generated/demo'

type Status = 0 | 1 | 2
const STATUS_LABEL: Record<Status, string> = {
  0: '待办',
  1: '进行中',
  2: '已完成',
}

interface Todo {
  id: number
  title: string
  description: string
  status: number
  dueAt: string | null
  createdAt: string
  updatedAt: string
}

interface ListResp {
  total: number
  items: Todo[]
}

interface FormValues {
  title: string
  description?: string
  status?: Status
  dueAt?: string | undefined
}

/** 将日期字符串格式化为中国时区 YYYY-MM-DD HH:mm:ss */

const STATUS_OPTIONS = (Object.entries(STATUS_LABEL) as [string, string][]).map(
  ([value, label]) => ({ value: Number(value), label }),
)

const Todos: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchList = async () => {
    const res = await demoV1TodosList({})
    // generated service 返回业务响应（data 字段已是列表）
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: FormValues) => {
    await demoV1TodosCreate(
      {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        status: values.status ?? 0,
        dueAt: values.dueAt,
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: FormValues) => {
    if (!editing) return
    await demoV1TodosUpdate(
      { id: String(editing.id) },
      {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        status: values.status ?? 0,
        dueAt: values.dueAt,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await demoV1TodosDelete({ id: String(id) }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const columns: ProColumns<Todo>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '标题',
      dataIndex: 'title',
      width: 220,
    },
    {
      title: '描述',
      dataIndex: 'description',
      search: false,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'select',
      fieldProps: { options: STATUS_OPTIONS },
      valueEnum: STATUS_LABEL,
    },
    {
      title: '截止时间',
      dataIndex: 'dueAt',
      width: 180,
      search: false,
      valueType: 'dateTime',
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
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <a onClick={() => setEditing(record)}>编辑</a>
          <Popconfirm
            title="确定删除该 Todo？"
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
    <PageContainer
      header={{
        title: 'Todo 示例',
      }}
    >
      <ProTable<Todo>
        headerTitle="Todo 列表"
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={fetchList}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        size="middle"
        dateFormatter="string"
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建
          </Button>,
        ]}
      />

      <ModalForm<FormValues>
        title="新建 Todo"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
        width={520}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true, max: 200 }]} />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 2000, rows: 3, showCount: true }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={0}
          options={STATUS_OPTIONS}
        />
        <ProFormDateTimePicker name="dueAt" label="截止时间" />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑 Todo #${editing.id}` : '编辑 Todo'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                title: editing.title,
                description: editing.description,
                status: editing.status as Status,
                dueAt: editing.dueAt,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
        width={520}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true, max: 200 }]} />
        <ProFormTextArea
          name="description"
          label="描述"
          fieldProps={{ maxLength: 2000, rows: 3, showCount: true }}
        />
        <ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} />
        <ProFormDateTimePicker name="dueAt" label="截止时间" />
      </ModalForm>
    </PageContainer>
  )
}

export default Todos