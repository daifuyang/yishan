import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { App, Button, Form, Input, InputNumber, Modal, Space } from 'antd';
import React, { useRef, useState } from 'react';
import {
  addMemberRemark,
  createMember,
  getMember,
  getMembers,
  updateMember,
} from '@/services/yishan-admin/crm';

const MemberPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [detail, setDetail] = useState<any>();
  const [form] = Form.useForm();
  const [remarkForm] = Form.useForm();

  const showForm = (record?: any) => {
    setEditing(record);
    form.setFieldsValue(record || { gender: 0 });
    setOpen(true);
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    { title: '会员编号', dataIndex: 'numberId' },
    { title: '顾客姓名', dataIndex: 'name' },
    { title: '手机', dataIndex: 'mobile', search: false },
    { title: '项目', dataIndex: 'project', search: false },
    { title: '所属客服', dataIndex: ['owner', 'username'], search: false },
    { title: '备注数', dataIndex: ['_count', 'remarks'], search: false },
    { title: '浏览数', dataIndex: ['_count', 'browses'], search: false },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <a onClick={() => showForm(record)}>编辑</a>
          <a
            onClick={async () => {
              const res = await getMember(record.id);
              setDetail(res.data);
              setDetailOpen(true);
            }}
          >
            详情/备注
          </a>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        headerTitle="会员顾客"
        request={async (params) => {
          const res = await getMembers({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.name || params.numberId,
          });
          return {
            data: res.data || [],
            success: res.success,
            total: res.pagination?.total || 0,
          };
        }}
        columns={columns}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showForm()}
          >
            新建
          </Button>,
        ]}
      />
      <Modal
        title={editing ? '编辑会员' : '新建会员'}
        open={open}
        onOk={async () => {
          const values = await form.validateFields();
          const res = editing?.id
            ? await updateMember(editing.id, values)
            : await createMember(values);
          if (res.success) message.success(res.message);
          setOpen(false);
          actionRef.current?.reload();
        }}
        onCancel={() => setOpen(false)}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Space wrap align="start">
            <Form.Item name="numberId" label="会员编号">
              <Input />
            </Form.Item>
            <Form.Item
              name="name"
              label="顾客姓名"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="gender" label="性别 0男/1女">
              <InputNumber min={0} max={1} />
            </Form.Item>
            <Form.Item name="birthday" label="生日">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="ownerUserId" label="归属客服ID">
              <InputNumber />
            </Form.Item>
          </Space>
          <Form.Item name="mobile" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="project" label="项目">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="会员详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={760}
      >
        <p>
          编号：{detail?.numberId}，姓名：{detail?.name}，电话：{detail?.mobile}
          ，项目：{detail?.project}
        </p>
        <Form
          form={remarkForm}
          layout="vertical"
          onFinish={async (values) => {
            const res = await addMemberRemark(detail.id, values);
            if (res.success) message.success(res.message);
            remarkForm.resetFields();
            const next = await getMember(detail.id);
            setDetail(next.data);
          }}
        >
          <Form.Item
            name="content"
            label="新增备注"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            添加备注
          </Button>
        </Form>
        <div style={{ marginTop: 16 }}>
          {(detail?.remarks || []).map((item: any) => (
            <div
              key={item.id}
              style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}
            >
              {item.user?.username}: {item.content}
            </div>
          ))}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default MemberPage;
