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
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCustomer,
  dispatchCustomer,
  getCustomerStatuses,
  getCustomers,
  searchHospitals,
  updateCustomer,
} from '@/services/yishan-admin/crm';
import { getRegionTree } from '@/services/yishan-admin/regions';
import { getUserList } from '@/services/yishan-admin/sysUsers';

const toRegionOptions = (nodes: any[] = []): any[] =>
  nodes.map((node) => ({
    label: node.name,
    value: node.code,
    children:
      Array.isArray(node.children) && node.children.length > 0
        ? toRegionOptions(node.children)
        : undefined,
  }));

const CustomerPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [editing, setEditing] = useState<any>();
  const [current, setCurrent] = useState<any>();
  const [regionOptions, setRegionOptions] = useState<any[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [customerServiceOptions, setCustomerServiceOptions] = useState<
    Array<{ label: string; value: number }>
  >([]);
  const [customerStatusOptions, setCustomerStatusOptions] = useState<
    Array<{ label: string; value: number }>
  >([]);
  const [hospitalOptions, setHospitalOptions] = useState<
    Array<{ label: string; value: number }>
  >([]);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const dispatchSubmittingRef = useRef(false);
  const [form] = Form.useForm();
  const [dispatchForm] = Form.useForm();

  useEffect(() => {
    setRegionLoading(true);
    getRegionTree({ level: 3 })
      .then((res) => {
        if (res.success) setRegionOptions(toRegionOptions(res.data || []));
      })
      .finally(() => setRegionLoading(false));
  }, []);

  const loadHospitalOptions = useCallback(async (keyword?: string) => {
    setHospitalLoading(true);
    try {
      const res = await searchHospitals({ keyword });
      if (!res.success) return;
      setHospitalOptions(
        (res.data || []).map((hospital: any) => ({
          label: hospital.hospitalName,
          value: hospital.id,
        })),
      );
    } finally {
      setHospitalLoading(false);
    }
  }, []);

  useEffect(() => {
    getUserList({ pageSize: 100, status: '1' }).then((res) => {
      if (!res.success) return;
      setCustomerServiceOptions(
        (res.data || []).map((user) => ({
          label: user.realName
            ? `${user.realName}（${user.username || user.phone}）`
            : user.username || user.phone || `用户 #${user.id}`,
          value: user.id,
        })),
      );
    });
  }, []);

  useEffect(() => {
    getCustomerStatuses().then((res) => {
      if (!res.success) return;
      setCustomerStatusOptions(
        (res.data || []).map((status: any) => ({
          label: status.name,
          value: status.id,
        })),
      );
    });
  }, []);

  const showForm = (record?: any) => {
    setEditing(record);
    form.resetFields();
    const regionCodes =
      record?.provinceId && record?.cityId && record?.districtId
        ? [record.provinceId, record.cityId, record.districtId]
        : undefined;
    form.setFieldsValue(
      record
        ? {
            ...record,
            birthday: record.birthday ? dayjs(record.birthday) : undefined,
            regionCodes,
          }
        : { gender: 0, statusId: 1 },
    );
    setOpen(true);
  };

  const submitDispatch = async () => {
    if (dispatchSubmittingRef.current || !current?.id) return;

    dispatchSubmittingRef.current = true;
    setDispatchSubmitting(true);
    try {
      const values = await dispatchForm.validateFields();
      const res = await dispatchCustomer(current.id, {
        hospitalIds: values.hospitalIds,
        reply: values.reply,
      });
      if (!res.success) {
        message.error(res.message || '派单失败，请稍后重试');
        return;
      }
      message.success(res.message);
      setDispatchOpen(false);
      actionRef.current?.reload();
    } finally {
      dispatchSubmittingRef.current = false;
      setDispatchSubmitting(false);
    }
  };

  const submit = async () => {
    const values = await form.validateFields();
    const { regionCodes, ...restValues } = values;
    const payload = {
      ...restValues,
      birthday: values.birthday?.format('YYYY-MM-DD'),
      provinceId: regionCodes?.[0],
      cityId: regionCodes?.[1],
      districtId: regionCodes?.[2],
    };
    const res = editing?.id
      ? await updateCustomer(editing.id, payload)
      : await createCustomer(payload);
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
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size={16}>
          <a onClick={() => showForm(record)}>编辑</a>
          <a
            onClick={() => {
              setCurrent(record);
              dispatchForm.resetFields();
              dispatchForm.setFieldValue(
                'reply',
                '此客户是贵医院潜在客户，请跟进',
              );
              setDispatchOpen(true);
              void loadHospitalOptions();
            }}
          >
            派单
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
        headerTitle="客户管理"
        request={async (params) => {
          const res = await getCustomers({
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
        title={editing ? '编辑客户' : '新建客户'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        width={880}
        centered
        destroyOnHidden
        styles={{
          body: {
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: 24,
          },
        }}
      >
        <Form form={form} layout="vertical">
          <Divider titlePlacement="start" plain>
            基本信息
          </Divider>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item name="numberId" label="会员编号">
                <Input placeholder="请输入会员编号" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="ownerUserId" label="归属客服">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={customerServiceOptions}
                  placeholder="请选择归属客服"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="name"
                label="客户姓名"
                required
                rules={[{ required: true }]}
              >
                <Input placeholder="请输入客户姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="birthday" label="生日">
                <DatePicker
                  format="YYYY-MM-DD"
                  placeholder="请选择生日"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="gender" label="性别">
                <Select
                  options={[
                    { label: '保密', value: 0 },
                    { label: '男', value: 1 },
                    { label: '女', value: 2 },
                  ]}
                  placeholder="请选择性别"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="statusId" label="客户状态">
                <Select
                  options={customerStatusOptions}
                  placeholder="请选择客户状态"
                />
              </Form.Item>
            </Col>
          </Row>
          <Divider titlePlacement="start" plain>
            联系方式
          </Divider>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item name="mobile" label="手机号">
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="qq" label="QQ号">
                <Input placeholder="请输入QQ号" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="wechat" label="微信号">
                <Input placeholder="请输入微信号" />
              </Form.Item>
            </Col>
          </Row>
          <Divider titlePlacement="start" plain>
            地址与需求
          </Divider>
          <Row gutter={24}>
            <Col xs={24} md={8}>
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
            <Col xs={24} md={16}>
              <Form.Item name="address" label="详细地址">
                <Input placeholder="请输入详细地址" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="plastic" label="整形项目">
                <Input placeholder="请输入整形项目" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea placeholder="请输入备注" rows={4} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Modal
        title={`派单：${current?.name || ''}`}
        open={dispatchOpen}
        onOk={submitDispatch}
        onCancel={() => {
          if (!dispatchSubmitting) setDispatchOpen(false);
        }}
        confirmLoading={dispatchSubmitting}
        okButtonProps={{ disabled: dispatchSubmitting }}
        cancelButtonProps={{ disabled: dispatchSubmitting }}
        closable={!dispatchSubmitting}
        maskClosable={!dispatchSubmitting}
        keyboard={!dispatchSubmitting}
        width={640}
        centered
        destroyOnHidden
      >
        <Form form={dispatchForm} layout="vertical">
          <Form.Item
            name="hospitalIds"
            label="派单医院"
            rules={[{ required: true }]}
            extra="可按医院名称搜索并同时选择多家医院，最多 50 家。"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              filterOption={false}
              disabled={dispatchSubmitting}
              loading={hospitalLoading}
              options={hospitalOptions}
              placeholder="搜索并选择派单医院"
              onSearch={(keyword) => void loadHospitalOptions(keyword)}
              notFoundContent={
                hospitalLoading ? '正在加载医院…' : '没有找到医院'
              }
            />
          </Form.Item>
          <Form.Item name="reply" label="派单留言">
            <Input.TextArea disabled={dispatchSubmitting} rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default CustomerPage;
