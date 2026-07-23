/**
 * 商品 SKU 管理 — 完整 CRUD 演示页（独立管理入口，区别于商品页内的 SKU 抽屉）。
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
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, InputNumber, message, Popconfirm, Space, Tag, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useRef, useState } from 'react'
import {
  deleteShopV1SkusId,
  getShopV1ProductsIdSkus,
  patchShopV1SkusId,
  postShopV1ProductsIdSkus,
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

interface Sku {
  id: number
  productId: number
  skuCode: string
  skuName: string
  price: string
  costPrice: string | null
  stock: number
  weight: string | null
  coverImage: string | null
  status: number
  createdAt: string
  updatedAt: string
}

interface FormValues {
  skuCode: string
  skuName: string
  price: number | string
  costPrice?: number | string
  stock?: number
  weight?: number | string
  coverImage?: string
  status?: Status
}

const Skus: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Sku | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [productId, setProductId] = useState<number | null>(null)

  const fetchList = async () => {
    if (productId == null) {
      return { data: [], success: true, total: 0 }
    }
    const res = await getShopV1ProductsIdSkus({ id: productId })
    const items = (res as unknown as Sku[]) ?? []
    return {
      data: items,
      success: true,
      total: items.length,
    }
  }

  const handleCreate = async (values: FormValues) => {
    if (productId == null) {
      message.error('请先选择商品 ID')
      return
    }
    await postShopV1ProductsIdSkus(
      { id: productId },
      {
        skuCode: values.skuCode.trim(),
        skuName: values.skuName.trim(),
        price: String(values.price),
        costPrice: values.costPrice != null ? String(values.costPrice) : undefined,
        stock: values.stock,
        weight: values.weight != null ? String(values.weight) : undefined,
        coverImage: values.coverImage?.trim() || undefined,
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
    await patchShopV1SkusId(
      { id: editing.id },
      {
        skuCode: values.skuCode.trim(),
        skuName: values.skuName.trim(),
        price: String(values.price),
        costPrice: values.costPrice != null ? String(values.costPrice) : undefined,
        stock: values.stock,
        weight: values.weight != null ? String(values.weight) : undefined,
        coverImage: values.coverImage?.trim() || undefined,
        status: values.status ?? 1,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1SkusId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({
    value: Number(value),
    label,
  }))

  const columns: ProColumns<Sku>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: 'SKU 编码', dataIndex: 'skuCode', width: 160 },
    {
      title: 'SKU 名称',
      dataIndex: 'skuName',
      width: 240,
      ellipsis: true,
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      search: false,
      render: (_, record) => `¥${Number(record.price).toFixed(2)}`,
    },
    { title: '库存', dataIndex: 'stock', width: 100, search: false },
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
          title="确定删除该 SKU？"
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
        title: 'SKU 管理',
        subTitle: '商品 SKU（多规格）',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          disabled={productId == null}
          onClick={() => setCreateOpen(true)}
        >
          新建 SKU
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            SKU 列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            通过 openapi 生成的 services 调用 <code>shop/v1/products/:id/skus</code> 与{' '}
            <code>shop/v1/skus/:id</code> 四个端点；
            类型与字段与 <code>apps/yishan-api/src/modules/shop/schemas/products.schema.ts</code>{' '}
            同步。
          </Paragraph>

          <Space>
            <span>商品 ID：</span>
            <InputNumber
              min={1}
              placeholder="请输入商品 ID"
              value={productId ?? undefined}
              onChange={(v) => setProductId(v == null ? null : Number(v))}
              style={{ width: 200 }}
            />
            <Button
              onClick={() => actionRef.current?.reload()}
              disabled={productId == null}
            >
              查询
            </Button>
          </Space>

          <ProTable<Sku>
            rowKey="id"
            actionRef={actionRef}
            columns={columns}
            request={fetchList}
            search={false}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </ProCard>

      <ModalForm<FormValues>
        title="新建 SKU"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="skuCode"
          label="SKU 编码"
          rules={[{ required: true, max: 64 }]}
        />
        <ProFormText
          name="skuName"
          label="SKU 名称"
          rules={[{ required: true, max: 500 }]}
        />
        <ProFormDigit
          name="price"
          label="价格"
          rules={[{ required: true }]}
          min={0}
          fieldProps={{ precision: 2, step: 0.01, prefix: '¥' }}
        />
        <ProFormDigit
          name="costPrice"
          label="成本价"
          min={0}
          fieldProps={{ precision: 2, step: 0.01, prefix: '¥' }}
        />
        <ProFormDigit name="stock" label="库存" min={0} initialValue={0} />
        <ProFormDigit
          name="weight"
          label="重量"
          min={0}
          fieldProps={{ precision: 2, step: 0.01 }}
        />
        <ProFormText
          name="coverImage"
          label="封面图"
          fieldProps={{ maxLength: 500 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue={1}
          options={statusOptions}
        />
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑 SKU #${editing.id}` : '编辑 SKU'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                skuCode: editing.skuCode,
                skuName: editing.skuName,
                price: Number(editing.price),
                costPrice: editing.costPrice != null ? Number(editing.costPrice) : undefined,
                stock: editing.stock,
                weight: editing.weight != null ? Number(editing.weight) : undefined,
                coverImage: editing.coverImage ?? '',
                status: editing.status as Status,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="skuCode"
          label="SKU 编码"
          rules={[{ required: true, max: 64 }]}
        />
        <ProFormText
          name="skuName"
          label="SKU 名称"
          rules={[{ required: true, max: 500 }]}
        />
        <ProFormDigit
          name="price"
          label="价格"
          rules={[{ required: true }]}
          min={0}
          fieldProps={{ precision: 2, step: 0.01, prefix: '¥' }}
        />
        <ProFormDigit
          name="costPrice"
          label="成本价"
          min={0}
          fieldProps={{ precision: 2, step: 0.01, prefix: '¥' }}
        />
        <ProFormDigit name="stock" label="库存" min={0} />
        <ProFormDigit
          name="weight"
          label="重量"
          min={0}
          fieldProps={{ precision: 2, step: 0.01 }}
        />
        <ProFormText
          name="coverImage"
          label="封面图"
          fieldProps={{ maxLength: 500 }}
        />
        <ProFormSelect name="status" label="状态" options={statusOptions} />
      </ModalForm>
    </PageContainer>
  )
}

export default Skus
