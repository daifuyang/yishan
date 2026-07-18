import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Form, Input, InputNumber, Modal, Space } from 'antd';
import React, { useRef, useState } from 'react';
import { addDispatchLog, addDispatchReply, getDispatch, getDispatches, updateDispatch } from '@/services/yishan-admin/crm';

const DispatchPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [detail, setDetail] = useState<any>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [replyForm] = Form.useForm();
  const [logForm] = Form.useForm();

  const loadDetail = async (id: number) => {
    const res = await getDispatch(id);
    setDetail(res.data);
    form.setFieldsValue(res.data);
    setOpen(true);
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    { title: '医院', dataIndex: ['hospital', 'hospitalName'] },
    { title: '客户', dataIndex: ['customer', 'name'] },
    { title: '手机', dataIndex: ['customer', 'mobile'], search: false },
    { title: '整形项目', dataIndex: ['customer', 'plastic'], search: false },
    { title: '状态', dataIndex: ['status', 'name'], search: false },
    { title: '派单客服', dataIndex: ['customer', 'owner', 'username'], search: false },
    { title: '派单时间', dataIndex: 'createdAt', valueType: 'dateTime', search: false },
    { title: '操作', valueType: 'option', render: (_, record) => [<a key="detail" onClick={() => loadDetail(record.id)}>处理</a>] },
  ];

  return (
    <PageContainer>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        headerTitle="派单管理"
        request={async (params) => {
          const res = await getDispatches({ page: params.current, pageSize: params.pageSize, keyword: params.hospital });
          return { data: res.data || [], success: res.success, total: res.pagination?.total || 0 };
        }}
        columns={columns}
        toolBarRender={() => [<Button key="export" href="/api/modules/crm/v1/admin/dispatches/export" target="_blank">导出CSV</Button>]}
      />
      <Modal title="派单处理" open={open} onCancel={() => setOpen(false)} footer={null} width={860}>
        <p>客户：{detail?.customer?.name}，医院：{detail?.hospital?.hospitalName}</p>
        <Form form={form} layout="vertical" onFinish={async (values) => {
          const res = await updateDispatch(detail.id, values);
          if (res.success) message.success(res.message);
          actionRef.current?.reload();
        }}>
          <Space wrap align="start">
            <Form.Item name="hospitalId" label="医院ID"><InputNumber /></Form.Item>
            <Form.Item name="statusId" label="状态ID"><InputNumber /></Form.Item>
            <Form.Item name="receiveQq" label="对接QQ"><Input /></Form.Item>
            <Form.Item name="receiveWechat" label="对接微信"><Input /></Form.Item>
          </Space>
          <Form.Item name="image" label="重单截图URL"><Input /></Form.Item>
          <Button type="primary" htmlType="submit">保存派单</Button>
        </Form>
        <Form form={replyForm} layout="vertical" style={{ marginTop: 24 }} onFinish={async (values) => {
          const res = await addDispatchReply(detail.id, values);
          if (res.success) message.success(res.message);
          replyForm.resetFields();
          await loadDetail(detail.id);
        }}>
          <Form.Item name="content" label="新增回复"><Input.TextArea rows={3} /></Form.Item>
          <Button htmlType="submit">添加回复</Button>
        </Form>
        <Form form={logForm} layout="vertical" style={{ marginTop: 24 }} onFinish={async (values) => {
          const res = await addDispatchLog(detail.id, values);
          if (res.success) message.success(res.message);
          logForm.resetFields();
          await loadDetail(detail.id);
        }}>
          <Form.Item name="content" label="新增跟进日志"><Input.TextArea rows={3} /></Form.Item>
          <Button htmlType="submit">添加日志</Button>
        </Form>
        <div style={{ marginTop: 16 }}>
          <h4>回复记录</h4>
          {(detail?.replies || []).map((item: any) => <div key={item.id}>{item.user?.username}: {item.content}</div>)}
          <h4 style={{ marginTop: 16 }}>跟进日志</h4>
          {(detail?.logs || []).map((item: any) => <div key={item.id}>{item.user?.username}: {item.content}</div>)}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default DispatchPage;

