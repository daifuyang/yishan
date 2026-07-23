/**
 * 商城订单 — 完整 CRUD 演示页。
 *
 * 通过 openapi 生成的 services 调用后端 API，类型与字段与后端 schema 同步。
 * 主表：orders 列表；操作列提供"查看明细"按钮，在 Drawer 中展示订单 items。
 */
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProCard,
  ProFormDigit,
  ProFormItem,
  ProFormList,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, Drawer, message, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import { Plus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import {
  deleteShopV1OrdersId,
  getShopV1Orders,
  getShopV1OrdersId,
  getShopV1OrdersIdItems,
  patchShopV1OrdersId,
  postShopV1Orders,
} from '@/services/generated/shop'

const { Title, Paragraph } = Typography

type OrderStatus = 0 | 1 | 2 | 3 | 4
const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  0: '待付款',
  1: '待发货',
  2: '已发货',
  3: '已完成',
  4: '已取消',
}
const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  0: 'default',
  1: 'processing',
  2: 'blue',
  3: 'success',
  4: 'warning',
}

type PayStatus = 0 | 1
const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  0: '未支付',
  1: '已支付',
}
const PAY_STATUS_COLOR: Record<PayStatus, string> = {
  0: 'default',
  1: 'success',
}

interface OrderItem {
  id: number
  orderId: number
  productId: number
  skuId: number | null
  skuName: string | null
  coverImage: string | null
  productName: string
  price: string
  quantity: number
  subtotal: string
}

interface Order {
  id: number
  orderNo: string
  userId: number
  totalAmount: string
  freightAmount: string
  discountAmount: string
  payAmount: string
  payStatus: number
  payTime: string | null
  payMethod: string | null
  orderStatus: number
  expressCompany: string | null
  expressNo: string | null
  deliverTime: string | null
  receiveTime: string | null
  cancelReason: string | null
  remark: string | null
  items?: OrderItem[]
  createdAt: string
  updatedAt: string
}

interface ListResp {
  total: number
  items: Order[]
}

interface OrderItemFormValues {
  productId: number
  skuId?: number
  productName: string
  price: string
  quantity: number
  subtotal: string
  coverImage?: string
}

interface FormValues {
  orderNo: string
  userId: number
  totalAmount: string
  freightAmount?: string
  discountAmount?: string
  payAmount: string
  orderStatus?: OrderStatus
  remark?: string
  items: OrderItemFormValues[]
}

const Orders: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Order | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [detailItems, setDetailItems] = useState<OrderItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!detailOrder) {
      setDetailItems([])
      return
    }
    setDetailLoading(true)
    getShopV1OrdersIdItems({ id: detailOrder.id }, {})
      .then((items) => {
        setDetailItems((items as unknown as OrderItem[]) ?? [])
      })
      .catch(() => {
        message.error('加载订单明细失败')
      })
      .finally(() => setDetailLoading(false))
  }, [detailOrder])

  const fetchList = async (
    params: API.getShopV1OrdersParams & { current?: number; pageSize?: number },
  ) => {
    const { current, pageSize, keyword, userId, orderStatus, payStatus } = params
    const res = await getShopV1Orders(
      {
        page: current ?? 1,
        pageSize: pageSize ?? 10,
        keyword,
        userId,
        orderStatus,
        payStatus,
      },
      {},
    )
    const data = (res as unknown as ListResp) ?? null
    return {
      data: data?.items ?? [],
      success: true,
      total: data?.total ?? 0,
    }
  }

  const handleCreate = async (values: FormValues) => {
    await postShopV1Orders(
      {
        orderNo: values.orderNo.trim(),
        userId: Number(values.userId),
        totalAmount: values.totalAmount,
        freightAmount: values.freightAmount,
        discountAmount: values.discountAmount,
        payAmount: values.payAmount,
        orderStatus: values.orderStatus ?? 0,
        remark: values.remark?.trim() ?? '',
        items: values.items.map((it) => ({
          productId: Number(it.productId),
          skuId: it.skuId != null ? Number(it.skuId) : null,
          productName: it.productName.trim(),
          price: it.price,
          quantity: Number(it.quantity),
          subtotal: it.subtotal,
          coverImage: it.coverImage,
        })),
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const handleUpdate = async (values: FormValues) => {
    if (!editing) return
    await patchShopV1OrdersId(
      { id: editing.id },
      {
        orderStatus: values.orderStatus,
        remark: values.remark?.trim() ?? '',
      },
      {},
    )
    message.success('已更新')
    setEditing(null)
    actionRef.current?.reload()
  }

  const handleDelete = async (id: number) => {
    await deleteShopV1OrdersId({ id }, {})
    message.success('已删除')
    actionRef.current?.reload()
  }

  const handleViewDetail = async (record: Order) => {
    try {
      const full = (await getShopV1OrdersId(
        { id: record.id },
        {},
      )) as unknown as Order
      setDetailOrder(full)
    } catch {
      setDetailOrder(record)
    }
  }

  const columns: ProColumns<Order>[] = [
    { title: 'ID', dataIndex: 'id', width: 80, search: false },
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 200,
      copyable: true,
    },
    { title: '用户 ID', dataIndex: 'userId', width: 100 },
    {
      title: '应付金额',
      dataIndex: 'payAmount',
      width: 120,
      search: false,
      render: (_, r) => `¥ ${r.payAmount}`,
    },
    {
      title: '订单状态',
      dataIndex: 'orderStatus',
      width: 110,
      valueType: 'select',
      fieldProps: {
        options: Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({
          value: Number(value),
          label,
        })),
      },
      render: (_, record) => (
        <Tag color={ORDER_STATUS_COLOR[record.orderStatus as OrderStatus]}>
          {ORDER_STATUS_LABEL[record.orderStatus as OrderStatus]}
        </Tag>
      ),
    },
    {
      title: '支付状态',
      dataIndex: 'payStatus',
      width: 110,
      valueType: 'select',
      fieldProps: {
        options: Object.entries(PAY_STATUS_LABEL).map(([value, label]) => ({
          value: Number(value),
          label,
        })),
      },
      render: (_, record) => (
        <Tag color={PAY_STATUS_COLOR[record.payStatus as PayStatus]}>
          {PAY_STATUS_LABEL[record.payStatus as PayStatus]}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => setEditing(record)}>
          编辑
        </Button>,
        <Button key="detail" type="link" onClick={() => handleViewDetail(record)}>
          查看明细
        </Button>,
        <Popconfirm
          key="del"
          title="确定删除该订单？"
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

  const orderStatusOptions = Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({
    value: Number(value),
    label,
  }))

  return (
    <PageContainer
      header={{
        title: '订单管理',
        subTitle: '商城订单',
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<Plus size={16} strokeWidth={1.8} />}
          onClick={() => setCreateOpen(true)}
        >
          新建订单
        </Button>,
      ]}
    >
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            订单列表
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            通过 openapi 生成的 services 调用 <code>getShopV1Orders*</code> 等端点；
            类型与字段与 <code>apps/yishan-api/src/modules/shop/schemas/orders.schema.ts</code> 同步。
          </Paragraph>
          <ProTable<Order>
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
        title="新建订单"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true, width: 720 }}
      >
        <ProFormText
          name="orderNo"
          label="订单号"
          rules={[{ required: true, min: 1, max: 32 }]}
        />
        <ProFormDigit name="userId" label="用户 ID" rules={[{ required: true }]} min={1} />
        <ProFormText name="totalAmount" label="订单总额" rules={[{ required: true }]} />
        <ProFormText name="freightAmount" label="运费金额" />
        <ProFormText name="discountAmount" label="优惠金额" />
        <ProFormText name="payAmount" label="应付金额" rules={[{ required: true }]} />
        <ProFormSelect
          name="orderStatus"
          label="订单状态"
          initialValue={0}
          options={orderStatusOptions}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          fieldProps={{ maxLength: 500, rows: 3 }}
        />
        <ProFormList
          name="items"
          label="订单明细"
          itemRender={({ listDom, action }) => (
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                padding: 12,
                marginBottom: 8,
                position: 'relative',
              }}
            >
              <div style={{ marginBottom: 8, fontWeight: 500 }}>明细</div>
              <div style={{ position: 'absolute', right: 8, top: 8 }}>{action}</div>
              {listDom}
            </div>
          )}
        >
          <ProFormDigit
            name="productId"
            label="商品 ID"
            rules={[{ required: true }]}
            min={1}
          />
          <ProFormDigit name="skuId" label="SKU ID" min={0} />
          <ProFormText
            name="productName"
            label="商品名称"
            rules={[{ required: true, max: 200 }]}
          />
          <ProFormText name="price" label="单价" rules={[{ required: true }]} />
          <ProFormDigit
            name="quantity"
            label="数量"
            rules={[{ required: true }]}
            min={1}
          />
          <ProFormText name="subtotal" label="小计" rules={[{ required: true }]} />
          <ProFormText name="coverImage" label="封面图 URL" />
        </ProFormList>
      </ModalForm>

      <ModalForm<FormValues>
        title={editing ? `编辑订单 #${editing.id}` : '编辑订单'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onFinish={handleUpdate}
        initialValues={
          editing
            ? {
                orderNo: editing.orderNo,
                userId: editing.userId,
                totalAmount: editing.totalAmount,
                freightAmount: editing.freightAmount,
                discountAmount: editing.discountAmount,
                payAmount: editing.payAmount,
                orderStatus: editing.orderStatus as OrderStatus,
                remark: editing.remark ?? '',
              }
            : undefined
        }
        modalProps={{ destroyOnClose: true, width: 720 }}
      >
        <ProFormItem label="订单号">
          <span>{editing?.orderNo}</span>
        </ProFormItem>
        <ProFormItem label="用户 ID">
          <span>{editing?.userId}</span>
        </ProFormItem>
        <ProFormItem label="应付金额">
          <span>¥ {editing?.payAmount}</span>
        </ProFormItem>
        <ProFormSelect
          name="orderStatus"
          label="订单状态"
          options={orderStatusOptions}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          fieldProps={{ maxLength: 500, rows: 3 }}
        />
      </ModalForm>

      <Drawer
        title={detailOrder ? `订单明细：${detailOrder.orderNo}` : '订单明细'}
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        width={720}
        destroyOnClose
      >
        {detailOrder ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <ProCard title="订单信息" size="small">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>订单号：{detailOrder.orderNo}</div>
                <div>用户 ID：{detailOrder.userId}</div>
                <div>订单总额：¥ {detailOrder.totalAmount}</div>
                <div>运费：¥ {detailOrder.freightAmount}</div>
                <div>优惠：¥ {detailOrder.discountAmount}</div>
                <div>应付：¥ {detailOrder.payAmount}</div>
                <div>
                  订单状态：
                  <Tag color={ORDER_STATUS_COLOR[detailOrder.orderStatus as OrderStatus]}>
                    {ORDER_STATUS_LABEL[detailOrder.orderStatus as OrderStatus]}
                  </Tag>
                </div>
                <div>
                  支付状态：
                  <Tag color={PAY_STATUS_COLOR[detailOrder.payStatus as PayStatus]}>
                    {PAY_STATUS_LABEL[detailOrder.payStatus as PayStatus]}
                  </Tag>
                </div>
                {detailOrder.payMethod ? <div>支付方式：{detailOrder.payMethod}</div> : null}
                {detailOrder.payTime ? (
                  <div>支付时间：{new Date(detailOrder.payTime).toLocaleString()}</div>
                ) : null}
                {detailOrder.expressCompany || detailOrder.expressNo ? (
                  <div>
                    物流：{detailOrder.expressCompany ?? '-'} / 运单号 {detailOrder.expressNo ?? '-'}
                  </div>
                ) : null}
                {detailOrder.remark ? <div>备注：{detailOrder.remark}</div> : null}
                <div>创建时间：{new Date(detailOrder.createdAt).toLocaleString()}</div>
              </Space>
            </ProCard>
            <ProCard title="订单商品" size="small">
              <Table<OrderItem>
                rowKey="id"
                size="small"
                loading={detailLoading}
                dataSource={detailItems}
                pagination={false}
                columns={[
                  {
                    title: '商品',
                    dataIndex: 'productName',
                    render: (_, r) => (
                      <Space>
                        {r.coverImage ? (
                          <img
                            src={r.coverImage}
                            alt={r.productName}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : null}
                        <div>
                          <div>{r.productName}</div>
                          {r.skuName ? (
                            <div style={{ color: '#999', fontSize: 12 }}>{r.skuName}</div>
                          ) : null}
                        </div>
                      </Space>
                    ),
                  },
                  { title: '单价', dataIndex: 'price', width: 100, render: (v) => `¥ ${v}` },
                  { title: '数量', dataIndex: 'quantity', width: 80 },
                  { title: '小计', dataIndex: 'subtotal', width: 120, render: (v) => `¥ ${v}` },
                ]}
              />
            </ProCard>
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  )
}

export default Orders