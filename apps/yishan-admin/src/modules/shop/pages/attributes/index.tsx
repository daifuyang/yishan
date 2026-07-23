/**
 * 商品属性管理 — 完整 CRUD 演示页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 * 主表：attribute 列表；操作列提供"管理值"按钮，在 Drawer 中维护该属性下的属性值。
 */
import {
  type ActionType,
  DrawerForm,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import {
  deleteShopV1AttributesId,
  deleteShopV1AttributesIdValues,
  getShopV1Attributes,
  getShopV1AttributesIdValues,
  patchShopV1AttributesId,
  postShopV1Attributes,
  postShopV1AttributesIdValues,
} from '@/services/generated/shop'

const { Title, Paragraph } = Typography

type AttributeType = 1 | 2 | 3
const TYPE_LABEL: Record<AttributeType, string> = {
  1: '文本',
  2: '图片',
  3: '颜色',
}
const TYPE_COLOR: Record<AttributeType, string> = {
  1: 'blue',
  2: 'purple',
  3: 'orange',
}

type Status = 0 | 1
const STATUS_LABEL: Record<Status, string> = {
  0: '禁用',
  1: '启用',
}
const STATUS_COLOR: Record<Status, string> = {
  0: 'default',
  1: 'success',
}

interface Attribute {
  id: number
  name: string
  type: number
  sortOrder: number
  status: number
  createdAt: string
  updatedAt: string
}

interface AttributeValue {
  id: number
  attributeId: number
  value: string
  image: string | null
  sortOrder: number
  status: number
}

interface ListResp {
  total: number
  items: Attribute[]
}

interface FormValues {
  name: string
  type?: AttributeType
  sortOrder?: number
  status?: Status
}

interface ValueFormValues {
  value: string
  image?: string
  sortOrder?: number
  status?: Status
}

const Attributes: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Attribute | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [valuesDrawer, setValuesDrawer] = useState<Attribute | null>(null)
  const [values, setValues] = useState<AttributeValue[]>([])
  const [valuesLoading, setValuesLoading] = useState(false)

  const fetchList = async (params: {
    page?: number
    pageSize?: number
    keyword?: string
    type?: number
    status?: number
  }) => {
    const res = await getShopV1Attributes({
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      keyword: params.keyword,
      type: params.type,
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
    await postShopV1Attributes(
      {
        name: values.name.trim(),
        type: values.type ?? 1,
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
    await patchShopV1AttributesId(
      { id: editing.id },
      {
        name: values.name.trim(),
        type: values.type,
        sortOrder: values.sortOrder,
        status: values.status,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1AttributesId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const loadValues = async (attributeId: number) => {
    setValuesLoading(true)
    try {
      const res = await getShopV1AttributesIdValues({ id: attributeId }, {})
      setValues((res as unknown as AttributeValue[]) ?? [])
    } finally {
      setValuesLoading(false)
    }
  }

  useEffect(() => {
    if (valuesDrawer) {
      loadValues(valuesDrawer.id)
    } else {
      setValues([])
    }
  }, [valuesDrawer])

  const handleAddValue = async (formVals: ValueFormValues) => {
    if (!valuesDrawer) return false
    await postShopV1AttributesIdValues(
      { id: valuesDrawer.id },
      {
        value: formVals.value.trim(),
        image: formVals.image?.trim() ?? '',
        sortOrder: formVals.sortOrder ?? 0,
        status: formVals.status ?? 1,
      },
      {},
    )
    message.success('已添加')
    await loadValues(valuesDrawer.id)
    return true
  }

  const handleClearValues = async () => {
    if (!valuesDrawer) return
    await deleteShopV1AttributesIdValues({ id: valuesDrawer.id }, {})
    message.success('已清空')
    await loadValues(valuesDrawer.id)
  }

  const columns: ProColumns<Attribute>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '名称',
      dataIndex: 'name',
      width: 200,
      fieldProps: { maxLength: 50 },
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      valueType: 'select',
      fieldProps: {
        options: Object.entries(TYPE_LABEL).map(([value, label]) => ({
          value: Number(value),
          label,
        })),
      },
      render: (_, record) => (
        <Tag color={TYPE_COLOR[record.type as AttributeType]}>
          {TYPE_LABEL[record.type as AttributeType] ?? '-'}
        </Tag>
      ),
    },
    { title: '排序', dataIndex: 'sortOrder', width: 80, search: false },
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
          {STATUS_LABEL[record.status as Status] ?? '-'}
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
      width: 240,
      render: (_, record) => [
        <Button key="values" type="link" onClick={() => setValuesDrawer(record)}>
          管理值
        </Button>,
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="del"
          title="确定删除该属性？"
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

  const valueColumns: ProColumns<AttributeValue>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: '值', dataIndex: 'value', width: 200 },
    {
      title: '图片',
      dataIndex: 'image',
      width: 240,
      search: false,
      render: (_, record) =>
        record.image ? (
          <a href={record.image} target="_blank" rel="noreferrer">
            {record.image}
          </a>
        ) : (
          '-'
        ),
    },
    { title: '排序', dataIndex: 'sortOrder', width: 80, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status as Status]}>
          {STATUS_LABEL[record.status as Status] ?? '-'}
        </Tag>
      ),
    },
  ]

  return (
    <PageContainer
      header={{
        title: '属性管理',
        subTitle: '商品属性（颜色/尺寸）+ 属性值',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建属性
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            属性列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            通过 openapi 生成的 services 调用 <code>getShopV1Attributes*</code>、
            <code>postShopV1Attributes</code> 等端点；
            类型与字段与 <code>apps/yishan-api/src/modules/shop/schemas/attributes.schema.ts</code> 同步。
          </Paragraph>
          <ProTable<Attribute>
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
        title="新建属性"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          rules={[{ required: true, max: 50 }]}
          fieldProps={{ maxLength: 50 }}
        />
        <ProFormSelect
          name="type"
          label="类型"
          initialValue={1}
          options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormDigit name="sortOrder" label="排序" initialValue={0} min={0} />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={1}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑属性 #${editing.id}` : '编辑属性'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                name: editing.name,
                type: editing.type as AttributeType,
                sortOrder: editing.sortOrder,
                status: editing.status as Status,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="name"
          label="名称"
          rules={[{ required: true, max: 50 }]}
          fieldProps={{ maxLength: 50 }}
        />
        <ProFormSelect
          name="type"
          label="类型"
          options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <ProFormDigit name="sortOrder" label="排序" min={0} />
        <ProFormSelect
          name="status"
          label="状态"
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
      </ModalForm>

      <DrawerForm<ValueFormValues>
        title={valuesDrawer ? `属性值管理：${valuesDrawer.name}` : '属性值管理'}
        open={!!valuesDrawer}
        onOpenChange={(open) => {
          if (!open) setValuesDrawer(null)
        }}
        onFinish={handleAddValue}
        submitter={false}
        drawerProps={{ destroyOnClose: true, width: 720 }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={5} style={{ margin: 0 }}>
            新增属性值
          </Title>
          <ProFormText
            name="value"
            label="值"
            rules={[{ required: true, max: 100 }]}
            fieldProps={{ maxLength: 100 }}
          />
          <ProFormText
            name="image"
            label="图片 URL"
            fieldProps={{ maxLength: 500 }}
          />
          <ProFormDigit name="sortOrder" label="排序" initialValue={0} min={0} />
          <ProFormSelect
            name="status"
            label="状态"
            initialValue={1}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value: Number(value),
              label,
            }))}
          />
          <Space>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
            <Popconfirm
              title="确定清空该属性下所有值？"
              okText="清空"
              cancelText="取消"
              onConfirm={handleClearValues}
            >
              <Button danger>清空所有值</Button>
            </Popconfirm>
          </Space>

          <Title level={5} style={{ margin: 0 }}>
            当前值列表
          </Title>
          <ProTable<AttributeValue>
            rowKey="id"
            columns={valueColumns}
            dataSource={values}
            loading={valuesLoading}
            search={false}
            options={false}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </DrawerForm>
    </PageContainer>
  )
}

export default Attributes
