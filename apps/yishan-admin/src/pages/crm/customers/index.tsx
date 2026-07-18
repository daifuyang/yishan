import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Form, Input, InputNumber, Modal, Space } from 'antd';
import React, { useRef, useState } from 'react';
import { createCustomer, dispatchCustomer, getCustomers, searchHospitals, updateCustomer } from '@/services/yishan-admin/crm';

const CustomerPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [current, setCurrent] = useState<any>();
  const [form] = Form.useForm();
  const [dispatchForm] = Form.useForm();

  const showForm = (record?: any) => {
    setEditing(record);
    form.setFieldsValue(record || { gender: 0, statusId: 1 });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const res = editing?.id ? await updateCustomer(editing.id, values) : await createCustomer(values);
    if (res.success) message.success(res.message);
    setOpen(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    { title: '会员编号', dataIndex: 'numberId' },
    { title: '客户姓名', dataIndex: 'name' },
    { title: '手机', dataIndex: 'mobile', search: false },
    { title: '整形项目', dataIndex: 'plastic', search: false },
    { title: '客户状态', dataIndex: ['status', 'name'], search: false },
    { title: '所属客服', dataIndex: ['owner', 'username'], search: false },
    { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime', search: false },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit" onClick={() => showForm(record)}>编辑</a>,
        <a key="dispatch" onClick={() => {
          setCurrent(record);
          dispatchForm.resetFields();
          setDispatchOpen(true);
        }}><SendOutlined /> 派单</a>,
      ],
    },
  ];

  return (
    <PageContainer>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        headerTitle="客户管理"
        request={async (params) => {
          const res = await getCustomers({ page: params.current, pageSize: params.pageSize, keyword: params.name || params.numberId });
          return { data: res.data || [], success: res.success, total: res.pagination?.total || 0 };
        }}
        columns={columns}
        toolBarRender={() => [<Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => showForm()}>新建</Button>]}
      />
      <Modal title={editing ? '编辑客户' : '新建客户'} open={open} onOk={submit} onCancel={() => setOpen(false)} width={820} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Space wrap align="start">
            <Form.Item name="numberId" label="会员编号"><Input /></Form.Item>
            <Form.Item name="name" label="客户姓名" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="gender" label="性别 0男/1女"><InputNumber min={0} max={1} /></Form.Item>
            <Form.Item name="birthday" label="生日"><Input placeholder="YYYY-MM-DD" /></Form.Item>
            <Form.Item name="ownerUserId" label="归属客服ID"><InputNumber /></Form.Item>
            <Form.Item name="statusId" label="客户状态ID"><InputNumber min={1} /></Form.Item>
          </Space>
          <Space wrap align="start">
            <Form.Item name="telphone" label="固定电话"><Input /></Form.Item>
            <Form.Item name="mobile" label="手机"><Input /></Form.Item>
            <Form.Item name="qq" label="QQ"><Input /></Form.Item>
            <Form.Item name="wechat" label="微信"><Input /></Form.Item>
          </Space>
          <Space wrap align="start">
            <Form.Item name="provinceId" label="省ID"><InputNumber /></Form.Item>
            <Form.Item name="cityId" label="市ID"><InputNumber /></Form.Item>
            <Form.Item name="districtId" label="区ID"><InputNumber /></Form.Item>
            <Form.Item name="address" label="地址"><Input style={{ width: 320 }} /></Form.Item>
          </Space>
          <Form.Item name="plastic" label="整形项目"><Input /></Form.Item>
          <Form.Item name="remark" label="重单理由/备注"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`派单：${current?.name || ''}`} open={dispatchOpen} onOk={async () => {
        const values = await dispatchForm.validateFields();
        const hospitalIds = String(values.hospitalIds).split(',').map((item) => Number(item.trim())).filter(Boolean);
        const res = await dispatchCustomer(current.id, { hospitalIds, reply: values.reply });
        if (res.success) message.success(res.message);
        setDispatchOpen(false);
      }} onCancel={() => setDispatchOpen(false)}>
        <Form form={dispatchForm} layout="vertical">
          <Form.Item name="hospitalIds" label="医院ID，多个用英文逗号分隔" rules={[{ required: true }]}><Input placeholder="1,2,3" /></Form.Item>
          <Form.Item name="reply" label="派单留言" initialValue="此客户是贵医院潜在客户，请跟进"><Input.TextArea rows={4} /></Form.Item>
          <Button onClick={async () => {
            const res = await searchHospitals({});
            message.info(`可选医院：${(res.data || []).map((item: any) => `${item.id}-${item.hospitalName}`).join('，') || '暂无'}`);
          }}>查看医院ID</Button>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default CustomerPage;

