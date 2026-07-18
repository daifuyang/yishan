import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Cascader,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { FormEditor, type ImageUploadAdapter } from 'yishan-tiptap';
import { AttachmentMultiSelect } from '@/components';
import {
  createHospital,
  createHospitalAccount,
  deleteHospital,
  deleteHospitalAccount,
  getHospitalAccounts,
  getHospitals,
  updateHospital,
  updateHospitalAccount,
} from '@/services/yishan-admin/crm';
import { getRegionTree } from '@/services/yishan-admin/regions';
import {
  fetchCloudStorageConfig,
  resolveAttachmentPublicUrl,
  uploadAttachmentFile,
} from '@/utils/attachmentUpload';

const natureMap: Record<number, string> = {
  [-1]: '未选择',
  0: '民营',
  1: '公立',
};
const formGutter: [number, number] = [16, 0];
const thirdCol = { xs: 24, md: 8 };
const addressRegionCol = { xs: 24, md: 8 };
const addressDetailCol = { xs: 24, md: 16 };

const hospitalIntroductionImageUploadAdapter: ImageUploadAdapter = {
  upload: async (file) => {
    const res = await uploadAttachmentFile(file, {
      kind: 'image',
      dir: 'attachments',
    });
    if (!res.success) throw new Error(res.message || '图片上传失败');

    const attachment = res.data?.[0];
    const storedUrl = attachment?.path || attachment?.url;
    if (!storedUrl) throw new Error('上传成功但未返回图片地址');

    return resolveAttachmentPublicUrl(
      storedUrl,
      await fetchCloudStorageConfig(),
    );
  },
};

const toRegionOptions = (nodes: any[] = []): any[] =>
  nodes.map((node) => ({
    label: node.name,
    value: node.code,
    children:
      Array.isArray(node.children) && node.children.length > 0
        ? toRegionOptions(node.children)
        : undefined,
  }));

const HospitalPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message: antMessage } = App.useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [form] = Form.useForm();
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountHospitalId, setAccountHospitalId] = useState<number>();
  const [accountList, setAccountList] = useState<any[]>([]);
  const [accountListLoading, setAccountListLoading] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountEditing, setAccountEditing] = useState<any>();
  const [accountForm] = Form.useForm();
  const [regionOptions, setRegionOptions] = useState<any[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);

  useEffect(() => {
    setRegionLoading(true);
    getRegionTree({ level: 3 })
      .then((res) => {
        if (res.success) setRegionOptions(toRegionOptions(res.data || []));
      })
      .finally(() => setRegionLoading(false));
  }, []);

  const showForm = (record?: any) => {
    setEditing(record);
    const regionCodes =
      record?.provinceId && record?.cityId && record?.districtId
        ? [record.provinceId, record.cityId, record.districtId]
        : undefined;
    form.setFieldsValue(
      record ? { ...record, regionCodes } : { hospitalNature: -1, status: 1 },
    );
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const { regionCodes, ...restValues } = values;
    const payload = {
      ...restValues,
      provinceId: regionCodes?.[0],
      cityId: regionCodes?.[1],
      districtId: regionCodes?.[2],
    };
    const res = editing?.id
      ? await updateHospital(editing.id, payload)
      : await createHospital(payload);
    if (res.success) antMessage.success(res.message);
    setOpen(false);
    actionRef.current?.reload();
  };

  const loadAccounts = async (hospitalId: number) => {
    setAccountListLoading(true);
    try {
      const res = await getHospitalAccounts(hospitalId);
      if (res.success) setAccountList(res.data || []);
    } finally {
      setAccountListLoading(false);
    }
  };

  const openAccountDrawer = async (hospitalId: number) => {
    setAccountHospitalId(hospitalId);
    setAccountDrawerOpen(true);
    await loadAccounts(hospitalId);
  };

  const openAccountModal = (editingRow?: any) => {
    setAccountEditing(editingRow);
    if (editingRow) {
      accountForm.setFieldsValue({
        username: editingRow.user?.username,
        realName: editingRow.user?.realName,
        phone: editingRow.user?.phone,
        email: editingRow.user?.email,
        role: editingRow.role,
        status: editingRow.status,
        remark: editingRow.remark ?? '',
      });
    } else {
      accountForm.resetFields();
    }
    setAccountModalOpen(true);
  };

  const submitAccountCreate = async () => {
    if (!accountHospitalId) return;
    const values = await accountForm.validateFields();
    // 后端 create schema 不接受 status 字段,新建后后端会强制 status=1(启用)。
    // 如果用户希望停用,请创建后通过编辑账号调整。这里从 payload 中过滤掉。
    const { status: _unusedStatus, ...payload } = values;
    const res = await createHospitalAccount(accountHospitalId, payload);
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success(res.message);
    setAccountModalOpen(false);
    accountForm.resetFields();
    await loadAccounts(accountHospitalId);
  };

  const submitAccountEdit = async () => {
    if (!accountHospitalId || !accountEditing) return;
    const values = await accountForm.validateFields();
    const res = await updateHospitalAccount(
      accountHospitalId,
      accountEditing.userId,
      values,
    );
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success(res.message);
    setAccountModalOpen(false);
    accountForm.resetFields();
    setAccountEditing(undefined);
    await loadAccounts(accountHospitalId);
  };

  const handleAccountDelete = async (userId: number) => {
    if (!accountHospitalId) return;
    const res = await deleteHospitalAccount(accountHospitalId, userId);
    if (!res.success) {
      antMessage.error(res.message);
      return;
    }
    antMessage.success(res.message);
    await loadAccounts(accountHospitalId);
  };

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    { title: '医院名称', dataIndex: 'hospitalName' },
    {
      title: '账号数',
      dataIndex: 'accountCount',
      search: false,
      render: (_, record) => (
        <Button type="link" onClick={() => openAccountDrawer(record.id)}>
          {record.accountCount || 0}
        </Button>
      ),
    },
    { title: '咨询电话', dataIndex: 'hospitalPhone', search: false },
    { title: '营销电话', dataIndex: 'hospitalSelling', search: false },
    {
      title: '性质',
      dataIndex: 'hospitalNature',
      search: false,
      render: (_, r) => natureMap[r.hospitalNature] || '-',
    },
    {
      title: '微信绑定',
      dataIndex: 'wechatOpenid',
      search: false,
      render: (_, r) =>
        r.wechatOpenid ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        1: { text: '启用', status: 'Success' },
        0: { text: '停用', status: 'Default' },
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={16}>
          <a key="accounts" onClick={() => openAccountDrawer(record.id)}>
            账号管理
          </a>
          <a key="edit" onClick={() => showForm(record)}>
            编辑
          </a>
          <Popconfirm
            key="delete"
            title="确定删除该医院吗？"
            onConfirm={async () => {
              const res = await deleteHospital(record.id);
              if (res.success) antMessage.success(res.message);
              actionRef.current?.reload();
            }}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const accountColumns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    {
      title: '账号名称',
      dataIndex: ['user', 'username'],
      render: (_, r: any) => (
        <Space size={4}>
          <span>{r.user?.realName || '-'}</span>
          <span style={{ color: '#999' }}>({r.user?.username || '-'})</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      render: (_, r: any) => (
        <Tag color={r.status === 1 ? 'green' : 'red'}>
          {r.status === 1 ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      width: 170,
      render: (_, r: any) =>
        r.createdAt ? dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      search: false,
      width: 170,
      render: (_, r: any) =>
        r.updatedAt ? dayjs(r.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, record: any) => (
        <Space size={16}>
          <a key="edit" onClick={() => openAccountModal(record)}>
            编辑
          </a>
          <Popconfirm
            key="delete"
            title="确定解除该账号关联?"
            onConfirm={() => handleAccountDelete(record.userId)}
          >
            <a style={{ color: '#ff4d4f' }}>解除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        headerTitle="医院管理"
        search={{ labelWidth: 100 }}
        request={async (params) => {
          const res = await getHospitals({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.hospitalName,
            status: params.status,
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
        title={editing ? '编辑医院' : '新建医院'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        width={960}
        destroyOnHidden
        maskClosable={false}
        styles={{
          body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 },
        }}
      >
        <Form form={form} layout="vertical">
          <Divider titlePlacement="left" plain>
            基本信息
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item
                name="hospitalName"
                label="医院名称"
                rules={[{ required: true, message: '请输入医院名称' }]}
              >
                <Input
                  disabled={Boolean(editing?.id)}
                  placeholder="请输入医院名称"
                />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="status" label="状态">
                <Select
                  placeholder="请选择状态"
                  options={[
                    { label: '启用', value: 1 },
                    { label: '停用', value: 0 },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="hospitalNature" label="经营性质">
                <Select
                  placeholder="请选择经营性质"
                  options={[
                    { label: '未选择', value: -1 },
                    { label: '民营', value: 0 },
                    { label: '公立', value: 1 },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            地址信息
          </Divider>
          <Row gutter={formGutter}>
            <Col {...addressRegionCol}>
              <Form.Item name="regionCodes" label="省市区">
                <Cascader
                  allowClear
                  changeOnSelect
                  loading={regionLoading}
                  options={regionOptions}
                  placeholder="请选择省市区"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col {...addressDetailCol}>
              <Form.Item name="hospitalAddress" label="详细地址">
                <Input placeholder="请输入详细地址" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            联系方式
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="hospitalPhone" label="咨询电话">
                <Input placeholder="请输入咨询电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="hospitalSelling" label="营销电话">
                <Input placeholder="请输入营销电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="hospitalWebsite" label="官网">
                <Input placeholder="https://" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="doctorName" label="就医联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="doctorPhone" label="就医电话">
                <Input placeholder="就医联系电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="doctorQq" label="就医QQ">
                <Input placeholder="QQ号" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="receptionName" label="前台联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="receptionPhone" label="前台电话">
                <Input placeholder="前台联系电话" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="receptionQq" label="前台QQ">
                <Input placeholder="QQ号" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            交通信息
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="busStation" label="公交站">
                <Input placeholder="公交站点" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="busAddress" label="公交路线">
                <Input placeholder="公交路线说明" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="subwayStation" label="地铁站">
                <Input placeholder="地铁站点" />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="subwayAddress" label="地铁路线">
                <Input placeholder="地铁路线说明" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            商务政策
          </Divider>
          <Row gutter={formGutter}>
            <Col {...thirdCol}>
              <Form.Item name="taxiFare" label="出租车费">
                <Input placeholder="例如: 约35元" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="vipDiscount" label="会员优惠">
                <Input placeholder="请输入会员优惠" />
              </Form.Item>
            </Col>
            <Col {...thirdCol}>
              <Form.Item name="returnPoint" label="医院返点">
                <Input placeholder="例如: 10%" />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>
            补充资料
          </Divider>
          <Form.Item name="hospitalIntroduction" label="医院简介">
            <FormEditor
              maxHeight={360}
              imageUploadAdapter={hospitalIntroductionImageUploadAdapter}
            />
          </Form.Item>
          <Form.Item name="contractPhotos" label="合同图片">
            <AttachmentMultiSelect kind="image" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="账号管理"
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        width={1024}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setAccountDrawerOpen(false)}>关闭</Button>
          </div>
        }
      >
        <ProTable
          rowKey={(rec: any) => rec.userId}
          loading={accountListLoading}
          search={false}
          options={false}
          dataSource={accountList}
          pagination={false}
          columns={accountColumns}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openAccountModal()}
            >
              新建
            </Button>,
          ]}
        />
      </Drawer>

      <Modal
        title={accountEditing ? '编辑账号' : '新建账号'}
        open={accountModalOpen}
        onOk={accountEditing ? submitAccountEdit : submitAccountCreate}
        onCancel={() => setAccountModalOpen(false)}
        width={760}
        destroyOnHidden
      >
        <Form form={accountForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="账号"
                rules={[{ required: true }]}
              >
                <Input placeholder="请输入账号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: !accountEditing }]}
                extra={accountEditing ? '留空则不修改' : undefined}
              >
                <Input.Password
                  placeholder={accountEditing ? '留空则不修改' : '请输入密码'}
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="手机号"
                rules={[{ required: true }]}
              >
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="医院内角色"
                rules={[{ required: true }]}
                initialValue={!accountEditing ? 'member' : undefined}
              >
                <Select placeholder="请选择角色">
                  <Select.Option value="owner">负责人</Select.Option>
                  <Select.Option value="admin">管理员</Select.Option>
                  <Select.Option value="member">普通账号</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true }]}
                initialValue={!accountEditing ? 1 : undefined}
              >
                <Select placeholder="请选择状态">
                  <Select.Option value={1}>启用</Select.Option>
                  <Select.Option value={0}>停用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="realName" label="真实姓名">
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea placeholder="请输入备注" rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default HospitalPage;
