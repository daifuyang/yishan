/**
 * Shop 商品管理页面
 *
 * 功能：商品列表、创建、编辑、删除、上下架切换、SKU 子资源
 */

import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { Button, Drawer, message, Popconfirm, Space, Tag } from 'antd'
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

const statusColors: Record<number, string> = { 0: 'default', 1: 'success', 2: 'warning' }
const statusText: Record<number, string> = { 0: '下架', 1: '上架', 2: '回收站' }

const STATUS_OPTIONS = [
  { value: 0, label: '下架' },
  { value: 1, label: '上架' },
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
  coverImage?: string
  price: number
  description?: string
  status?: number
  isHot?: boolean
  isNew?: boolean
}

interface SkuFormValues {
  skuCode: string
  skuName: string
  price: number
  costPrice?: number
  stock?: number
  weight?: string
  coverImage?: string
  status?: number
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [formVisible, setFormVisible] = useState(false)
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
    const data = (res as unknown as ProductListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const closeForm = () => {
    setFormVisible(false)
    setEditing(null)
  }

  const handleCreate = async (values: ProductFormValues) => {
    await postShopV1Products(
      {
        categoryId: Number(values.categoryId),
        name: values.name.trim(),
        coverImage: values.coverImage?.trim() ?? '',
        description: values.description?.trim() ?? '',
        price: toPriceString(values.price) ?? '0.00',
        status: values.status ?? 1,
        isHot: values.isHot ?? false,
        isNew: values.isNew ?? false,
      },
      {},
    )
    message.success('已创建')
    closeForm()
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: ProductFormValues) => {
    if (!editing) return
    await patchShopV1ProductsId(
      { id: editing.id },
      {
        categoryId: Number(values.categoryId),
        name: values.name.trim(),
        coverImage: values.coverImage?.trim() ?? '',
        description: values.description?.trim() ?? '',
        price: toPriceString(values.price) ?? '0.00',
        status: values.status,
        isHot: values.isHot,
        isNew: values.isNew,
      },
      {},
    )
    message.success('已更新')
    closeForm()
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1ProductsId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const handleRecycle = async (id: number) => {
    await patchShopV1ProductsId({ id }, { status: 0 }, {})
    message.success('已下架')
    actionRef.current?.reload()
  }

  const handleRestore = async (id: number) => {
    await patchShopV1ProductsId({ id }, { status: 1 }, {})
    message.success('已上架')
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
    { title: '关键词', dataIndex: 'keyword', hideInTable: true },
    { title: 'ID', dataIndex: 'id', search: false, width: 64 },
    {
      title: '商品名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
      search: false,
    },
    {
      title: '分类',
      dataIndex: 'categoryId',
      search: false,
      width: 100,
      render: (_, record) => record.categoryId,
    },
    {
      title: '价格',
      dataIndex: 'price',
      search: false,
      width: 100,
      render: (_, record) => formatPrice(record.price),
    },
    { title: '库存', dataIndex: 'stock', search: false, width: 64 },
    { title: '销量', dataIndex: 'clickCount', search: false, width: 64 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueType: 'select',
      fieldProps: { options: STATUS_OPTIONS },
      render: (_, record) => (
        <Tag color={statusColors[record.status] ?? 'default'}>
          {statusText[record.status] ?? '未知'}
        </Tag>
      ),
    },
    {
      title: '推荐',
      dataIndex: 'isHot',
      search: false,
      width: 64,
      render: (_, record) => (record.isHot ? <Tag color="red">热</Tag> : null),
    },
    {
      title: '新品',
      dataIndex: 'isNew',
      search: false,
      width: 64,
      render: (_, record) => (record.isNew ? <Tag color="blue">新</Tag> : null),
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
      width: 220,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => setEditing(record)}>编辑</a>
          {record.status === 0 ? (
            <a onClick={() => handleRestore(record.id)}>上架</a>
          ) : (
            <a onClick={() => handleRecycle(record.id)}>下架</a>
          )}
          <Popconfirm title="确定要删除该商品吗？" onConfirm={() => handleDelete(record.id)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
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
        <Tag color={statusColors[record.status] ?? 'default'}>
          {statusText[record.status] ?? '未知'}
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
    <PageContainer>
      <ProTable<Product>
        headerTitle="商品列表"
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
            onClick={() => setFormVisible(true)}
          >
            新建商品
          </Button>,
        ]}
        request={fetchList}
        columns={productColumns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 1400 }}
      />

      <ModalForm<ProductFormValues>
        title={editing ? '编辑商品' : '新建商品'}
        open={formVisible}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
        width={720}
        layout="horizontal"
        labelCol={{ span: 4 }}
        initialValues={
          editing
            ? {
                categoryId: editing.categoryId,
                name: editing.name,
                coverImage: editing.coverImage ?? '',
                description: editing.description ?? '',
                price: Number(editing.price),
                status: editing.status,
                isHot: editing.isHot,
                isNew: editing.isNew,
              }
            : {
                status: 1,
                isHot: false,
                isNew: false,
              }
        }
        onFinish={async (values) => {
          if (editing) {
            await handleUpdate(values)
          } else {
            await handleCreate(values)
          }
          return true
        }}
      >
        <ProFormDigit
          name="categoryId"
          label="分类"
          placeholder="分类 ID"
          rules={[{ required: true, message: '请输入分类 ID' }]}
          min={1}
        />
        <ProFormText
          name="name"
          label="商品名称"
          placeholder="请输入商品名称"
          rules={[{ required: true, max: 200 }]}
        />
        <ProFormText
          name="coverImage"
          label="封面"
          placeholder="封面图片 URL"
          fieldProps={{ maxLength: 500 }}
        />
        <ProFormDigit
          name="price"
          label="价格"
          placeholder="商品价格"
          rules={[{ required: true, message: '请输入价格' }]}
          min={0}
          fieldProps={{ step: 0.01, precision: 2 }}
        />
        <ProFormTextArea
          name="description"
          label="简介"
          placeholder="商品简介"
          fieldProps={{ rows: 3 }}
        />
        <ProFormSelect name="status" label="状态" options={STATUS_OPTIONS} />
        <ProFormSwitch name="isHot" label="推荐" />
        <ProFormSwitch name="isNew" label="新品" />
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
              icon={<PlusOutlined />}
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
                status: skuEditing.status,
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
