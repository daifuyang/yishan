import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, Drawer, Image, message, Popconfirm, Space, Tag, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import {
  deleteShopV1ProductsId,
  deleteShopV1SkusId,
  getShopV1Products,
  getShopV1ProductsIdSkus,
  patchShopV1ProductsId,
  patchShopV1SkusId,
  postShopV1Products,
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

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}))

const BOOLEAN_OPTIONS = [
  { value: true, label: '是' },
  { value: false, label: '否' },
]

interface Product {
  id: number
  categoryId: number
  name: string
  subtitle: string | null
  coverImage: string | null
  images?: unknown
  description: string | null
  price: string
  costPrice: string | null
  stock: number
  unit: string
  weight: string | null
  status: number
  isHot: boolean
  isNew: boolean
  sortOrder: number
  clickCount: number
  createdAt: string
  updatedAt: string
}

interface ProductListResp {
  total: number
  items: Product[]
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

interface ProductFormValues {
  categoryId: number
  name: string
  subtitle?: string
  coverImage?: string
  description?: string
  price: number
  costPrice?: number
  stock?: number
  unit?: string
  weight?: string
  status?: Status
  isHot?: boolean
  isNew?: boolean
  sortOrder?: number
}

interface SkuFormValues {
  skuCode: string
  skuName: string
  price: number
  costPrice?: number
  stock?: number
  weight?: string
  coverImage?: string
  status?: Status
}

const formatPrice = (value: string | number | null | undefined) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? `¥${amount.toFixed(2)}` : '-'
}

const toPriceString = (value: string | number | null | undefined) => {
  if (value === undefined || value === null || value === '') return undefined
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : undefined
}

const toOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === 'true' || value === '1'
  return undefined
}

const Products: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [skuProduct, setSkuProduct] = useState<Product | null>(null)
  const [skus, setSkus] = useState<Sku[]>([])
  const [skusLoading, setSkusLoading] = useState(false)
  const [skuEditing, setSkuEditing] = useState<Sku | null>(null)
  const [skuCreateOpen, setSkuCreateOpen] = useState(false)

  const fetchList = async (params: Record<string, unknown>) => {
    const res = await getShopV1Products({
      page: Number(params.current ?? params.page ?? 1),
      pageSize: Number(params.pageSize ?? 10),
      keyword: typeof params.keyword === 'string' ? params.keyword : undefined,
      categoryId: toOptionalNumber(params.categoryId),
      status: toOptionalNumber(params.status),
      isHot: toOptionalBoolean(params.isHot),
      isNew: toOptionalBoolean(params.isNew),
    })
    // generated service 返回业务响应（data 字段已是列表）
    const data = (res as unknown as ProductListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: ProductFormValues) => {
    await postShopV1Products(
      {
        categoryId: Number(values.categoryId),
        name: values.name.trim(),
        subtitle: values.subtitle?.trim() ?? '',
        coverImage: values.coverImage?.trim() ?? '',
        description: values.description?.trim() ?? '',
        price: toPriceString(values.price) ?? '0.00',
        costPrice: toPriceString(values.costPrice),
        stock: values.stock ?? 0,
        unit: values.unit?.trim() ?? '',
        weight: values.weight?.trim() ?? '',
        status: values.status ?? 1,
        isHot: values.isHot ?? false,
        isNew: values.isNew ?? false,
        sortOrder: values.sortOrder ?? 0,
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: ProductFormValues) => {
    if (!editing) return
    await patchShopV1ProductsId(
      { id: editing.id },
      {
        categoryId: Number(values.categoryId),
        name: values.name.trim(),
        subtitle: values.subtitle?.trim() ?? '',
        coverImage: values.coverImage?.trim() ?? '',
        description: values.description?.trim() ?? '',
        price: toPriceString(values.price) ?? '0.00',
        costPrice: toPriceString(values.costPrice),
        stock: values.stock,
        unit: values.unit?.trim() ?? '',
        weight: values.weight?.trim() ?? '',
        status: values.status,
        isHot: values.isHot,
        isNew: values.isNew,
        sortOrder: values.sortOrder,
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1ProductsId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const loadSkus = async (productId: number) => {
    setSkusLoading(true)
    try {
      const res = await getShopV1ProductsIdSkus({ id: productId }, {})
      setSkus((res as unknown as Sku[]) ?? [])
    } finally {
      setSkusLoading(false)
    }
  }

  useEffect(() => {
    if (skuProduct) {
      loadSkus(skuProduct.id)
    } else {
      setSkus([])
    }
  }, [skuProduct])

  const handleSkuCreate = async (values: SkuFormValues) => {
    if (!skuProduct) return false
    await postShopV1ProductsIdSkus(
      { id: skuProduct.id },
      {
        skuCode: values.skuCode.trim(),
        skuName: values.skuName.trim(),
        price: toPriceString(values.price) ?? '0.00',
        costPrice: toPriceString(values.costPrice),
        stock: values.stock ?? 0,
        weight: values.weight?.trim() ?? '',
        coverImage: values.coverImage?.trim() ?? '',
        status: values.status ?? 1,
      },
      {},
    )
    message.success('SKU 已创建')
    setSkuCreateOpen(false)
    await loadSkus(skuProduct.id)
    return true
  }

  const handleSkuUpdate = async (values: SkuFormValues) => {
    if (!skuEditing) return false
    const productId = skuProduct?.id
    await patchShopV1SkusId(
      { id: skuEditing.id },
      {
        skuCode: values.skuCode.trim(),
        skuName: values.skuName.trim(),
        price: toPriceString(values.price),
        costPrice: toPriceString(values.costPrice),
        stock: values.stock,
        weight: values.weight?.trim() ?? '',
        coverImage: values.coverImage?.trim() ?? '',
        status: values.status,
      },
      {},
    )
    message.success('SKU 已更新')
    setSkuEditing(null)
    if (productId !== undefined) await loadSkus(productId)
    return true
  }

  const handleSkuDelete = async (id: number) => {
    await deleteShopV1SkusId({ id }, {})
    message.success('SKU 已删除')
    if (skuProduct) await loadSkus(skuProduct.id)
  }

  const productColumns: ProColumns<Product>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
    },
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '名称',
      dataIndex: 'name',
      width: 280,
      search: false,
      render: (_, record) => (
        <Space size="small">
          {record.coverImage ? (
            <Image
              src={record.coverImage}
              alt={record.name}
              width={40}
              height={40}
              preview={false}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                background: '#f5f5f5',
                color: '#999',
                fontSize: 12,
              }}
            >
              暂无
            </span>
          )}
          <span>{record.name}</span>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'categoryId',
      width: 110,
      valueType: 'digit',
      fieldProps: { min: 0 },
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      search: false,
      render: (_, record) => formatPrice(record.price),
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 100,
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      fieldProps: { options: STATUS_OPTIONS },
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status as Status] ?? 'default'}>
          {STATUS_LABEL[record.status as Status] ?? '未知'}
        </Tag>
      ),
    },
    {
      title: '热销/新品',
      dataIndex: 'isHot',
      width: 140,
      search: false,
      render: (_, record) => {
        const tags = [
          record.isHot ? <Tag key="hot" color="red">热销</Tag> : null,
          record.isNew ? <Tag key="new" color="blue">新品</Tag> : null,
        ].filter(Boolean)
        return tags.length > 0 ? <Space size={0}>{tags}</Space> : '-'
      },
    },
    {
      title: '热销',
      dataIndex: 'isHot',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: BOOLEAN_OPTIONS },
    },
    {
      title: '新品',
      dataIndex: 'isNew',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: BOOLEAN_OPTIONS },
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
      width: 280,
      render: (_, record) => [
        <Button key="skus" type="link" onClick={() => setSkuProduct(record)}>
          管理 SKU
        </Button>,
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="del"
          title="确定删除该商品？"
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

  const skuColumns: ProColumns<Sku>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    { title: 'SKU 编码', dataIndex: 'skuCode', width: 150, search: false },
    { title: 'SKU 名称', dataIndex: 'skuName', width: 220, search: false, ellipsis: true },
    {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      search: false,
      render: (_, record) => formatPrice(record.price),
    },
    { title: '库存', dataIndex: 'stock', width: 100, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status as Status] ?? 'default'}>
          {STATUS_LABEL[record.status as Status] ?? '未知'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => setSkuEditing(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="del"
          title="确定删除该 SKU？"
          okText="删除"
          cancelText="取消"
          onConfirm={() => handleSkuDelete(record.id)}
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
        title: '商品管理',
        subTitle: '商城商品 CRUD',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建商品
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            商品列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            通过 openapi 生成的 services 调用 <code>getShopV1Products*</code>、SKU 管理端点；
            类型与字段与 <code>apps/yishan-api/src/modules/shop/schemas/products.schema.ts</code> 同步。
          </Paragraph>
          <ProTable<Product>
            rowKey="id"
            actionRef={actionRef}
            columns={productColumns}
            request={fetchList}
            search={{ labelWidth: 'auto' }}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1300 }}
          />
        </Space>
      </ProCard>

      <ModalForm<ProductFormValues>
        title="新建商品"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormDigit
          name="categoryId"
          label="分类 ID"
          rules={[{ required: true, message: '请输入分类 ID' }]}
          min={1}
        />
        <ProFormText name="name" label="名称" rules={[{ required: true, max: 200 }]} />
        <ProFormText name="subtitle" label="副标题" fieldProps={{ maxLength: 500 }} />
        <ProFormText name="coverImage" label="封面图" fieldProps={{ maxLength: 500 }} />
        <ProFormTextArea name="description" label="描述" fieldProps={{ rows: 3 }} />
        <ProFormDigit
          name="price"
          label="价格"
          rules={[{ required: true, message: '请输入价格' }]}
          min={0}
          fieldProps={{ step: 0.01, precision: 2 }}
        />
        <ProFormDigit name="costPrice" label="成本价" min={0} fieldProps={{ step: 0.01, precision: 2 }} />
        <ProFormDigit name="stock" label="库存" min={0} />
        <ProFormText name="unit" label="单位" fieldProps={{ maxLength: 20 }} />
        <ProFormText name="weight" label="重量" />
        <ProFormSelect name="status" label="状态" initialValue={1} options={STATUS_OPTIONS} />
        <ProFormSwitch name="isHot" label="热销" initialValue={false} />
        <ProFormSwitch name="isNew" label="新品" initialValue={false} />
        <ProFormDigit name="sortOrder" label="排序" min={0} initialValue={0} />
      </ModalForm>

      <ModalForm<ProductFormValues>
        title={editing ? `编辑商品 #${editing.id}` : '编辑商品'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                categoryId: editing.categoryId,
                name: editing.name,
                subtitle: editing.subtitle ?? '',
                coverImage: editing.coverImage ?? '',
                description: editing.description ?? '',
                price: Number(editing.price),
                costPrice: editing.costPrice == null ? undefined : Number(editing.costPrice),
                stock: editing.stock,
                unit: editing.unit,
                weight: editing.weight ?? '',
                status: editing.status as Status,
                isHot: editing.isHot,
                isNew: editing.isNew,
                sortOrder: editing.sortOrder,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormDigit
          name="categoryId"
          label="分类 ID"
          rules={[{ required: true, message: '请输入分类 ID' }]}
          min={1}
        />
        <ProFormText name="name" label="名称" rules={[{ required: true, max: 200 }]} />
        <ProFormText name="subtitle" label="副标题" fieldProps={{ maxLength: 500 }} />
        <ProFormText name="coverImage" label="封面图" fieldProps={{ maxLength: 500 }} />
        <ProFormTextArea name="description" label="描述" fieldProps={{ rows: 3 }} />
        <ProFormDigit
          name="price"
          label="价格"
          rules={[{ required: true, message: '请输入价格' }]}
          min={0}
          fieldProps={{ step: 0.01, precision: 2 }}
        />
        <ProFormDigit name="costPrice" label="成本价" min={0} fieldProps={{ step: 0.01, precision: 2 }} />
        <ProFormDigit name="stock" label="库存" min={0} />
        <ProFormText name="unit" label="单位" fieldProps={{ maxLength: 20 }} />
        <ProFormText name="weight" label="重量" />
        <ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} />
        <ProFormSwitch name="isHot" label="热销" />
        <ProFormSwitch name="isNew" label="新品" />
        <ProFormDigit name="sortOrder" label="排序" min={0} />
      </ModalForm>

      <Drawer
        title={skuProduct ? `SKU 管理：${skuProduct.name}` : 'SKU 管理'}
        open={!!skuProduct}
        onClose={() => setSkuProduct(null)}
        width={900}
        destroyOnClose
      >
        <ProTable<Sku>
          rowKey="id"
          columns={skuColumns}
          dataSource={skus}
          loading={skusLoading}
          search={false}
          options={false}
          pagination={false}
          headerTitle="SKU 列表"
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<Plus size={16} strokeWidth={1.8} />}
              onClick={() => setSkuCreateOpen(true)}
            >
              新建 SKU
            </Button>,
          ]}
          scroll={{ x: 900 }}
        />
      </Drawer>

      <ModalForm<SkuFormValues>
        title="新建 SKU"
        open={skuCreateOpen}
        onOpenChange={setSkuCreateOpen}
        onFinish={handleSkuCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="skuCode" label="SKU 编码" rules={[{ required: true, max: 64 }]} />
        <ProFormText name="skuName" label="SKU 名称" rules={[{ required: true, max: 500 }]} />
        <ProFormDigit
          name="price"
          label="价格"
          rules={[{ required: true, message: '请输入价格' }]}
          min={0}
          fieldProps={{ step: 0.01, precision: 2 }}
        />
        <ProFormDigit name="costPrice" label="成本价" min={0} fieldProps={{ step: 0.01, precision: 2 }} />
        <ProFormDigit name="stock" label="库存" min={0} initialValue={0} />
        <ProFormText name="weight" label="重量" />
        <ProFormText name="coverImage" label="封面图" fieldProps={{ maxLength: 500 }} />
        <ProFormSelect name="status" label="状态" initialValue={1} options={STATUS_OPTIONS} />
      </ModalForm>

      <ModalForm<SkuFormValues>
        title={skuEditing ? `编辑 SKU #${skuEditing.id}` : '编辑 SKU'}
        open={!!skuEditing}
        onOpenChange={(open) => {
          if (!open) setSkuEditing(null)
        }}
        onFinish={handleSkuUpdate}
        initialValues={
          skuEditing
            ? {
                skuCode: skuEditing.skuCode,
                skuName: skuEditing.skuName,
                price: Number(skuEditing.price),
                costPrice: skuEditing.costPrice == null ? undefined : Number(skuEditing.costPrice),
                stock: skuEditing.stock,
                weight: skuEditing.weight ?? '',
                coverImage: skuEditing.coverImage ?? '',
                status: skuEditing.status as Status,
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="skuCode" label="SKU 编码" rules={[{ required: true, max: 64 }]} />
        <ProFormText name="skuName" label="SKU 名称" rules={[{ required: true, max: 500 }]} />
        <ProFormDigit
          name="price"
          label="价格"
          rules={[{ required: true, message: '请输入价格' }]}
          min={0}
          fieldProps={{ step: 0.01, precision: 2 }}
        />
        <ProFormDigit name="costPrice" label="成本价" min={0} fieldProps={{ step: 0.01, precision: 2 }} />
        <ProFormDigit name="stock" label="库存" min={0} />
        <ProFormText name="weight" label="重量" />
        <ProFormText name="coverImage" label="封面图" fieldProps={{ maxLength: 500 }} />
        <ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} />
      </ModalForm>
    </PageContainer>
  )
}

export default Products
