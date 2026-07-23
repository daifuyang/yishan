/**
 * Shop 订单管理页面
 *
 * 功能：订单列表、详情查看、状态更新、发货
 */
import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormList,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, Drawer, message, Popconfirm, Space, Tag } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import {
  deleteShopV1OrdersId,
  getShopV1Orders,
  getShopV1OrdersId,
  getShopV1OrdersIdItems,
  patchShopV1OrdersId,
  postShopV1Orders,
} from '@/services/generated/shop'

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
}

interface CreateFormValues {
  orderNo: string
  userId: number
  totalAmount: string
  payAmount: string
  items: OrderItemFormValues[]
}

const OrderList: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [detailItems, setDetailItems] = useState<OrderItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Create order modal
  const [createOpen, setCreateOpen] = useState(false)

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

  const handleViewDetail = async (record: Order) => {
    try {
      const full = (await getShopV1OrdersId(
        { id: record.id },
        {},
      )) as unknown as Order
      setDetailOrder(full)
      setDetailOpen(true)
    } catch {
      setDetailOrder(record)
      setDetailOpen(true)
    }
  }

  const handleProcess = async (id: number) => {
    const res = await patchShopV1OrdersId({ id }, { orderStatus: 3 }, {})
    if (res) {
      message.success('已处理')
      actionRef.current?.reload()
    }
  }

  const handleComplete = async (id: number) => {
    const res = await patchShopV1OrdersId({ id }, { orderStatus: 3 }, {})
    if (res) {
      message.success('已完成')
      actionRef.current?.reload()
    }
  }

  const handleCancel = async (id: number) => {
    const res = await patchShopV1OrdersId(
      { id },
      { orderStatus: 4, cancelReason: '已取消' },
      {},
    )
    if (res) {
      message.success('已取消')
      actionRef.current?.reload()
    }
  }

  const handleRemove = async (id: number) => {
    const res = await deleteShopV1OrdersId({ id }, {})
    if (res) {
      message.success('已删除')
      actionRef.current?.reload()
    }
  }

  const handleCreate = async (values: CreateFormValues) => {
    await postShopV1Orders(
      {
        orderNo: values.orderNo.trim(),
        userId: Number(values.userId),
        totalAmount: values.totalAmount,
        payAmount: values.payAmount,
        items: values.items.map((it) => ({
          productId: Number(it.productId),
          skuId: it.skuId != null ? Number(it.skuId) : null,
          productName: it.productName.trim(),
          price: it.price,
          quantity: Number(it.quantity),
          subtotal: it.subtotal,
        })),
      },
      {},
    )
    message.success('已创建')
    setCreateOpen(false)
    actionRef.current?.reload()
  }

  const columns: ProColumns<Order>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 180,
      copyable: true,
    },
    {
      title: '用户名',
      dataIndex: 'userId',
      search: false,
      width: 100,
      render: (_, record) => `#${record.userId}`,
    },
    {
      title: '支付金额',
      dataIndex: 'payAmount',
      search: false,
      width: 100,
      render: (_, r) => `¥ ${r.payAmount}`,
    },
    {
      title: '支付状态',
      dataIndex: 'payStatus',
      width: 80,
      render: (_, record) => (
        <Tag color={PAY_STATUS_COLOR[record.payStatus as PayStatus]}>
          {PAY_STATUS_LABEL[record.payStatus as PayStatus]}
        </Tag>
      ),
    },
    {
      title: '订单状态',
      dataIndex: 'orderStatus',
      width: 80,
      render: (_, record) => (
        <Tag color={ORDER_STATUS_COLOR[record.orderStatus as OrderStatus]}>
          {ORDER_STATUS_LABEL[record.orderStatus as OrderStatus]}
        </Tag>
      ),
    },
    {
      title: '快递公司',
      dataIndex: 'expressCompany',
      search: false,
      width: 100,
    },
    {
      title: '快递单号',
      dataIndex: 'expressNo',
      search: false,
      width: 140,
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
      width: 200,
      render: (_, record) => (
        <Space size={12}>
          <a onClick={() => handleViewDetail(record)}>详情</a>
          {record.orderStatus === 2 && (
            <a onClick={() => handleProcess(record.id)}>处理</a>
          )}
          {record.orderStatus === 3 && (
            <a onClick={() => handleComplete(record.id)}>完成</a>
          )}
          <a onClick={() => handleCancel(record.id)}>取消</a>
          <Popconfirm
            title="确定要删除该订单吗？"
            onConfirm={() => handleRemove(record.id)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<Order>
        headerTitle="订单列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 100,
          defaultCollapsed: true,
        }}
        request={fetchList}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        scroll={{ x: 1400 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建订单
          </Button>,
        ]}
      />

      {/* Detail drawer */}
      <Drawer
        title={detailOrder ? `订单详情：${detailOrder.orderNo}` : '订单详情'}
        width={720}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detailOrder ? (
          <ProTable<OrderItem>
            rowKey="id"
            size="small"
            loading={detailLoading}
            dataSource={detailItems}
            pagination={false}
            search={false}
            options={false}
            headerTitle="订单商品"
            columns={[
              { title: '商品', dataIndex: 'productName' },
              {
                title: '单价',
                dataIndex: 'price',
                width: 100,
                render: (_, record) => `¥ ${record.price}`,
              },
              { title: '数量', dataIndex: 'quantity', width: 80 },
              {
                title: '小计',
                dataIndex: 'subtotal',
                width: 120,
                render: (_, record) => `¥ ${record.subtotal}`,
              },
            ]}
          />
        ) : null}
      </Drawer>

      {/* Create order modal — minimal */}
      <ModalForm<CreateFormValues>
        title="新建订单"
        open={createOpen}
        onOpenChange={setCreateOpen}
        layout="horizontal"
        labelCol={{ span: 4 }}
        width={720}
        onFinish={handleCreate}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText
          name="orderNo"
          label="订单号"
          rules={[{ required: true, min: 1, max: 32 }]}
        />
        <ProFormDigit
          name="userId"
          label="用户 ID"
          rules={[{ required: true }]}
          min={1}
        />
        <ProFormText
          name="totalAmount"
          label="订单总额"
          rules={[{ required: true }]}
        />
        <ProFormText
          name="payAmount"
          label="应付金额"
          rules={[{ required: true }]}
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
        </ProFormList>
      </ModalForm>
    </PageContainer>
  )
}

export default OrderList