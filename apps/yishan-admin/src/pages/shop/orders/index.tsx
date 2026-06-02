import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Space, App, Tag, Modal, Descriptions } from "antd";
import { ModalForm, ProFormText } from "@ant-design/pro-components";
import React, { useRef, useState } from "react";
import { getOrderList, updateOrderStatus, deliverOrder, getOrderDetail } from "@/services/yishan-admin/shop";

type ShopOrder = API.shopOrder;

const payStatusEnum = {
  "0": { text: "未支付", status: "Default" },
  "1": { text: "已支付", status: "Success" },
  "2": { text: "已退款", status: "Warning" },
} as const;

const orderStatusEnum = {
  "1": { text: "待付款", status: "Warning" },
  "2": { text: "待发货", status: "Processing" },
  "3": { text: "待收货", status: "Processing" },
  "4": { text: "已完成", status: "Success" },
  "5": { text: "已取消", status: "Default" },
  "6": { text: "已退款", status: "Warning" },
} as const;

const OrderList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ShopOrder | null>(null);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const deliverFormRef = useRef<any>(undefined);

  const handleViewDetail = async (id: number) => {
    const res = await getOrderDetail({ id });
    if (res.success && res.data) {
      setCurrentOrder(res.data);
      setDetailModalOpen(true);
    }
  };

  const handleUpdateStatus = async (id: number, status: NonNullable<API.shopUpdateOrderStatusReq['orderStatus']>) => {
    const res = await updateOrderStatus({ id }, { orderStatus: status });
    if (res.success) {
      message.success(res.message);
      actionRef.current?.reload();
    }
  };

  const handleDeliver = async (values: { expressCompany: string; expressNo: string }) => {
    if (!currentOrder) return false;
    const res = await deliverOrder({ id: currentOrder.id }, values);
    if (res.success) {
      message.success(res.message);
      setDeliverModalOpen(false);
      setDetailModalOpen(false);
      actionRef.current?.reload();
      return true;
    }
    return false;
  };

  const columns: ProColumns<ShopOrder>[] = [
    { title: "订单ID", dataIndex: "id", search: false, width: 80, responsive: ["md"] },
    { title: "订单编号", dataIndex: "orderNo", ellipsis: true, width: 180 },
    { title: "用户", dataIndex: "userName", width: 120, responsive: ["md"] },
    { title: "联系电话", dataIndex: "userPhone", search: false, width: 120, responsive: ["lg"] },
    {
      title: "订单金额",
      dataIndex: "payAmount",
      search: false,
      width: 100,
      render: (_, record) => `¥${record.payAmount}`,
    },
    { title: "支付状态", dataIndex: "payStatus", valueEnum: payStatusEnum, width: 100, responsive: ["md"] },
    { title: "订单状态", dataIndex: "orderStatus", valueEnum: orderStatusEnum, width: 100 },
    { title: "下单时间", dataIndex: "createdAt", search: false, valueType: "dateTime", width: 180, responsive: ["lg"] },
    {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      fixed: "right",
      width: 126,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Button type="link" size="small" onClick={() => handleViewDetail(record.id)}>
            查看详情
          </Button>
          {record.orderStatus === "1" && (
            <Button type="link" size="small" danger onClick={() => handleUpdateStatus(record.id, "5")}>
              取消订单
            </Button>
          )}
          {record.orderStatus === "2" && (
            <Button type="link" size="small" onClick={() => { setCurrentOrder(record); setDeliverModalOpen(true); }}>
              发货
            </Button>
          )}
          {record.orderStatus === "3" && (
            <Button type="link" size="small" onClick={() => handleUpdateStatus(record.id, "4")}>
              确认收货
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<ShopOrder>
        headerTitle="订单列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        request={async (params) => {
          const { current, pageSize, keyword, orderStatus, payStatus } = params as any;
          const result = await getOrderList({ page: current, pageSize, keyword, orderStatus, payStatus });
          return {
            data: result.data || [],
            success: result.success,
            total: (result as any).pagination?.total || 0,
          };
        }}
        columns={columns}
      />

      <Modal
        title="订单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={800}
      >
        {currentOrder && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单编号">{currentOrder.orderNo}</Descriptions.Item>
            <Descriptions.Item label="订单状态">
              <Tag>{currentOrder.orderStatusName}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户">{currentOrder.userName}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{currentOrder.userPhone}</Descriptions.Item>
            <Descriptions.Item label="收货人">{currentOrder.address.receiver}</Descriptions.Item>
            <Descriptions.Item label="收货电话">{currentOrder.address.phone}</Descriptions.Item>
            <Descriptions.Item label="收货地址" span={2}>
              {currentOrder.address.province}{currentOrder.address.city}{currentOrder.address.district}{currentOrder.address.address}
            </Descriptions.Item>
            <Descriptions.Item label="商品总额">¥{currentOrder.totalAmount}</Descriptions.Item>
            <Descriptions.Item label="运费">¥{currentOrder.freightAmount}</Descriptions.Item>
            <Descriptions.Item label="优惠">-¥{currentOrder.discountAmount}</Descriptions.Item>
            <Descriptions.Item label="实付金额" span={2}>
              <strong style={{ color: "#f00", fontSize: 16 }}>¥{currentOrder.payAmount}</strong>
            </Descriptions.Item>
          </Descriptions>
        )}
        {currentOrder?.items && (
          <>
            <h4 style={{ marginTop: 16 }}>商品明细</h4>
            <Descriptions column={1} bordered size="small">
              {currentOrder.items.map((item) => (
                <Descriptions.Item key={`${item.productId}-${item.skuId ?? "none"}`} label={item.productName}>
                  {item.skuName && <span>（{item.skuName}）</span>} × {item.quantity} = ¥{item.subtotal}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Modal>

      <ModalForm
        title="发货"
        formRef={deliverFormRef}
        open={deliverModalOpen}
        onOpenChange={setDeliverModalOpen}
        onFinish={handleDeliver}
        modalProps={{ destroyOnClose: true }}
        width={400}
      >
        <ProFormText
          name="expressCompany"
          label="物流公司"
          placeholder="请输入物流公司名称"
          rules={[{ required: true, message: "请输入物流公司名称" }]}
        />
        <ProFormText
          name="expressNo"
          label="物流单号"
          placeholder="请输入物流单号"
          rules={[{ required: true, message: "请输入物流单号" }]}
        />
      </ModalForm>
    </PageContainer>
  );
};

export default OrderList;
