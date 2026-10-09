/**
 * Shop SKU 管理页面
 *
 * 功能：按商品筛选 SKU、创建、编辑、删除
 * 表单：DrawerForm + grid 双列布局
 */

import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  DrawerForm,
  PageContainer,
  ProFormDigit,
  ProFormRadio,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Select, Space, Tag } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import {
  deleteShopV1SkusId,
  getShopV1Products,
  getShopV1ProductsIdSkus,
  patchShopV1SkusId,
  postShopV1ProductsIdSkus,
} from '@/services/generated/shop'

type Status = 0 | 1

const STATUS_TEXT: Record<Status, string> = { 0: '禁用', 1: '启用' }
const STATUS_COLOR: Record<Status, string> = { 0: 'error', 1: 'success' }
const STATUS_OPTIONS = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
]

interface Product {
  id: number
  name: string
}

interface ProductListResponse {
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

const Skus: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [productId, setProductId] = useState<number | null>(null)
  const [productOptions, setProductOptions] = useState<{ label: string; value: number }[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Sku | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadProducts = async () => {
      setProductsLoading(true)
      try {
        const response = await getShopV1Products({ page: 1, pageSize: 100 }, {})
        const data = response as unknown as ProductListResponse
        if (!cancelled) {
          setProductOptions(
            (data.items ?? []).map((product) => ({
              label: `${product.name}（ID: ${product.id}）`,
              value: product.id,
            })),
          )
        }
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    }

    void loadProducts()
    return () => {
      cancelled = true
    }
  }, [])

  const reload = () => actionRef.current?.reload()

  const fetchList = async () => {
    if (productId === null) return { data: [], success: true, total: 0 }

    const response = await getShopV1ProductsIdSkus({ id: productId }, {})
    const items = (response as unknown as Sku[]) ?? []
    return { data: items, success: true, total: items.length }
  }

  const handleSave = async (values: Record<string, any>) => {
    const payload = {
      skuCode: values.skuCode.trim(),
      skuName: values.skuName.trim(),
      price: values.price.trim(),
      costPrice: values.costPrice?.trim() || undefined,
      stock: values.stock,
      weight: values.weight?.trim() || undefined,
      coverImage: values.coverImage?.trim() || undefined,
      status: values.status ?? 1,
    }

    if (editing) {
      await patchShopV1SkusId({ id: editing.id }, payload, {})
      message.success('更新成功')
    } else {
      if (productId === null) {
        message.error('请先选择商品')
        return false
      }
      await postShopV1ProductsIdSkus({ id: productId }, payload, {})
      message.success('创建成功')
    }

    setDrawerOpen(false)
    setEditing(null)
    reload()
    return true
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1SkusId({ id }, {})
    message.success('删除成功')
    reload()
  }

  const columns: ProColumns<Sku>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    { title: 'SKU编码', dataIndex: 'skuCode', width: 140, search: false },
    {
      title: 'SKU名称',
      dataIndex: 'skuName',
      width: 240,
      ellipsis: true,
      search: false,
    },
    { title: '价格', dataIndex: 'price', width: 80, search: false },
    { title: '库存', dataIndex: 'stock', width: 64, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      search: false,
      render: (_, record) => (
        <Tag color={STATUS_COLOR[record.status as Status]}>
          {STATUS_TEXT[record.status as Status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={12}>
          <a
            onClick={() => {
              setEditing(record)
              setDrawerOpen(true)
            }}
          >
            编辑
          </a>
          <Popconfirm title="确定要删除该SKU吗？" onConfirm={() => handleDelete(record.id)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <Space style={{ marginBottom: 16 }}>
        <span>商品：</span>
        <Select<number>
          showSearch
          allowClear
          loading={productsLoading}
          optionFilterProp="label"
          placeholder="请选择商品"
          options={productOptions}
          value={productId ?? undefined}
          style={{ width: 320 }}
          onChange={(value) => {
            setProductId(value ?? null)
            setEditing(null)
            setDrawerOpen(false)
          }}
        />
      </Space>

      {productId !== null ? (
        <ProTable<Sku>
          headerTitle="SKU列表"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          params={{ productId }}
          request={fetchList}
          search={false}
          pagination={false}
          scroll={{ x: 828 }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              onClick={() => {
                setEditing(null)
                setDrawerOpen(true)
              }}
            >
              <PlusOutlined /> 新建SKU
            </Button>,
          ]}
        />
      ) : null}

      <DrawerForm
        title={editing ? '编辑SKU' : '新建SKU'}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setEditing(null)
        }}
        grid
        drawerProps={{
          destroyOnClose: true,
          maskClosable: false,
          width: 640,
        }}
        initialValues={
          editing
            ? {
                skuCode: editing.skuCode,
                skuName: editing.skuName,
                price: editing.price,
                costPrice: editing.costPrice ?? undefined,
                stock: editing.stock,
                weight: editing.weight ?? undefined,
                coverImage: editing.coverImage ?? undefined,
                status: editing.status as Status,
              }
            : { stock: 0, status: 1 }
        }
        onFinish={handleSave}
      >
        <ProFormText
          name="skuCode"
          label="SKU编码"
          placeholder="如：P001-RED-M"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入SKU编码' }]}
        />
        <ProFormText
          name="skuName"
          label="SKU名称"
          placeholder="如：红色M码"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入SKU名称' }]}
        />
        <ProFormText
          name="price"
          label="价格"
          placeholder="SKU价格"
          colProps={{ span: 12 }}
          rules={[{ required: true, message: '请输入价格' }]}
        />
        <ProFormText
          name="costPrice"
          label="成本价"
          placeholder="成本价格"
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="stock"
          label="库存"
          placeholder="库存数量"
          colProps={{ span: 12 }}
          min={0}
        />
        <ProFormText
          name="weight"
          label="重量"
          placeholder="重量（kg）"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="coverImage"
          label="封面图"
          placeholder="封面图片URL"
          colProps={{ span: 12 }}
        />
        <ProFormRadio.Group
          name="status"
          label="状态"
          colProps={{ span: 12 }}
          options={STATUS_OPTIONS}
        />
      </DrawerForm>
    </PageContainer>
  )
}

export default Skus
