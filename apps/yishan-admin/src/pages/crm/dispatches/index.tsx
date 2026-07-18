import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FormEditor, type ImageUploadAdapter } from 'yishan-tiptap';
import {
  addDispatchReply,
  getDispatch,
  getDispatches,
  getDispatchStatuses,
} from '@/services/yishan-admin/crm';
import { getRegionTree } from '@/services/yishan-admin/regions';
import {
  fetchCloudStorageConfig,
  resolveAttachmentPublicUrl,
  uploadAttachmentFile,
} from '@/utils/attachmentUpload';

const formatUser = (user: any) => user?.realName || user?.username || '系统';

const dispatchReplyImageUploadAdapter: ImageUploadAdapter = {
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

const findRegionName = (regions: any[], code?: number): string | undefined => {
  for (const region of regions) {
    if (String(region.value) === String(code)) return region.label;
    const childName = findRegionName(region.children || [], code);
    if (childName) return childName;
  }
  return undefined;
};

const DispatchPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [detail, setDetail] = useState<any>();
  const [open, setOpen] = useState(false);
  const [statusOptions, setStatusOptions] = useState<
    Array<{ label: string; value: number }>
  >([]);
  const [regionOptions, setRegionOptions] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [replyForm] = Form.useForm();

  const loadStatuses = useCallback(async () => {
    const res = await getDispatchStatuses();
    if (!res.success) return;
    setStatusOptions(
      (res.data || []).map((status: any) => ({
        label: status.name,
        value: status.id,
      })),
    );
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    getRegionTree({ level: 3 }).then((res) => {
      if (res.success) setRegionOptions(toRegionOptions(res.data || []));
    });
  }, []);

  const loadDetail = useCallback(
    async (id: number) => {
      const res = await getDispatch(id);
      if (!res.success) return;
      setDetail(res.data);
      replyForm.resetFields();
      replyForm.setFieldsValue({
        statusId: res.data?.statusId,
      });
      setOpen(true);
    },
    [replyForm],
  );

  const messages = useMemo(
    () =>
      (detail?.replies || [])
        .map((reply: any) => ({
          id: reply.id,
          authorType: reply.authorType || 'service',
          content: reply.content,
          createdAt: reply.createdAt,
          user: reply.user,
        }))
        .sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [detail?.replies],
  );

  const statusValueEnum = useMemo(
    () =>
      Object.fromEntries(
        statusOptions.map((status) => [status.value, { text: status.label }]),
      ),
    [statusOptions],
  );

  const columns: ProColumns<any>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 72 },
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '医院、客户姓名、手机或会员编号' },
    },
    { title: '医院', dataIndex: ['hospital', 'hospitalName'], search: false },
    { title: '客户', dataIndex: ['customer', 'name'], search: false },
    { title: '手机', dataIndex: ['customer', 'mobile'], search: false },
    { title: '整形项目', dataIndex: ['customer', 'plastic'], search: false },
    {
      title: '状态',
      dataIndex: 'statusId',
      valueType: 'select',
      valueEnum: statusValueEnum,
      render: (_, record) => (
        <Tag color="blue">{record.status?.name || '-'}</Tag>
      ),
    },
    {
      title: '派单客服',
      dataIndex: ['customer', 'owner', 'username'],
      search: false,
    },
    {
      title: '派单时间',
      dataIndex: 'createdAt',
      valueType: 'dateTimeRange',
      search: {
        transform: (value: any[]) => ({
          startTime: value?.[0]?.toISOString(),
          endTime: value?.[1]?.toISOString(),
        }),
      },
      render: (_, record) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 88,
      render: (_, record) => (
        <a onClick={() => void loadDetail(record.id)}>处理</a>
      ),
    },
  ];

  const reloadDetail = async () => {
    if (detail?.id) await loadDetail(detail.id);
    actionRef.current?.reload();
  };

  return (
    <PageContainer>
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        headerTitle="派单管理"
        request={async (params) => {
          const res = await getDispatches({
            page: params.current,
            pageSize: params.pageSize,
            keyword: params.keyword,
            statusId: params.statusId,
            startTime: params.startTime,
            endTime: params.endTime,
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
            key="export"
            href="/api/modules/crm/v1/admin/dispatches/export"
            target="_blank"
          >
            导出 CSV
          </Button>,
        ]}
      />
      <Modal
        title="处理派单"
        open={open}
        onCancel={() => !processing && setOpen(false)}
        footer={null}
        width={1280}
        centered
        destroyOnHidden
        closable={!processing}
        maskClosable={!processing}
        keyboard={!processing}
        styles={{
          body: {
            height: 'calc(100vh - 220px)',
            overflow: 'hidden',
            padding: 0,
          },
        }}
      >
        <Row style={{ height: '100%' }}>
          <Col
            xs={24}
            lg={11}
            style={{ borderRight: '1px solid #f0f0f0', height: '100%' }}
          >
            <div
              style={{
                height: '100%',
                overflowY: 'auto',
                padding: '16px 24px 0 0',
              }}
            >

              <Descriptions
                bordered
                colon={false}
                column={1}
                size="middle"
                styles={{
                  content: { wordBreak: 'break-word' },
                  label: { whiteSpace: 'nowrap', width: 100 },
                }}
              >
                <Descriptions.Item label="会员编号">
                  {detail?.customer?.numberId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="客户姓名">
                  {detail?.customer?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="性别">
                  {detail?.customer?.gender === 1
                    ? '男'
                    : detail?.customer?.gender === 2
                      ? '女'
                      : '保密'}
                </Descriptions.Item>
                <Descriptions.Item label="生日">
                  {detail?.customer?.birthday
                    ? dayjs(detail.customer.birthday).format('YYYY-MM-DD')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="派单医院">
                  {detail?.hospital?.hospitalName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="客户手机">
                  {detail?.customer?.mobile || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="QQ">
                  {detail?.customer?.qq || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="微信">
                  {detail?.customer?.wechat || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="省市区">
                  {[
                    findRegionName(regionOptions, detail?.customer?.provinceId),
                    findRegionName(regionOptions, detail?.customer?.cityId),
                    findRegionName(regionOptions, detail?.customer?.districtId),
                  ]
                    .filter(Boolean)
                    .join(' / ') || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="详细地址">
                  {detail?.customer?.address || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="整形项目">
                  {detail?.customer?.plastic || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="派单时间">
                  {detail?.createdAt
                    ? dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="当前状态">
                  {detail?.status?.name || '-'}
                </Descriptions.Item>
              </Descriptions>
            </div>
          </Col>
          <Col xs={24} lg={13} style={{ height: '100%' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden auto',
                padding: '16px 0 0 24px',
              }}
            >
              <Form
                form={replyForm}
                layout="vertical"
                style={{
                  display: 'flex',
                  flex: '1 1 auto',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
                onFinish={async (values) => {
                  if (processingRef.current || !detail?.id) return;
                  processingRef.current = true;
                  setProcessing(true);
                  try {
                    const res = await addDispatchReply(detail.id, values);
                    if (!res.success) {
                      message.error(res.message || '处理失败，请稍后重试');
                      return;
                    }
                    message.success(res.message);
                    replyForm.setFieldValue('content', '');
                    await reloadDetail();
                  } finally {
                    processingRef.current = false;
                    setProcessing(false);
                  }
                }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="statusId"
                      label="客户状态"
                      rules={[{ required: true, message: '请选择客户状态' }]}
                    >
                      <Select disabled={processing} options={statusOptions} />
                    </Form.Item>
                  </Col>
                </Row>
                <div
                  style={{
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    flex: '1 1 220px',
                    minHeight: 220,
                    overflowY: 'auto',
                    padding: 16,
                  }}
                >
                  {messages.length === 0 ? (
                    <Typography.Text type="secondary">
                      暂无对话，发送第一条消息开始跟进。
                    </Typography.Text>
                  ) : null}
                  {messages.map((item: any) => {
                    const isHospital = item.authorType === 'hospital';
                    const name = formatUser(item.user);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          gap: 12,
                          justifyContent: isHospital
                            ? 'flex-start'
                            : 'flex-end',
                          marginBottom: 16,
                        }}
                      >
                        {isHospital ? (
                          <Avatar>{name.slice(0, 1)}</Avatar>
                        ) : null}
                        <Card
                          size="small"
                          style={{
                            background: isHospital ? '#f5f5f5' : '#e6f4ff',
                            maxWidth: '78%',
                          }}
                        >
                          <Space size={8} wrap>
                            <Typography.Text strong>
                              {isHospital
                                ? `医院（${name}）`
                                : `悦助理（${name}）`}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                            </Typography.Text>
                          </Space>
                          <div
                            className='dispatch-reply-content'
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: reply HTML is sanitized at the CRM API boundary before it is returned.
                            dangerouslySetInnerHTML={{ __html: item.content }}
                          />
                        </Card>
                        {isHospital ? null : (
                          <Avatar style={{ background: '#1677ff' }}>
                            {name.slice(0, 1)}
                          </Avatar>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Form.Item
                  name="content"
                  rules={[{ required: true, message: '请填写留言' }]}
                  style={{ margin: '16px 0 8px' }}
                >
                  <FormEditor
                    composer={{
                      disabled: processing,
                      onSend: () => replyForm.submit(),
                    }}
                    imageUploadAdapter={dispatchReplyImageUploadAdapter}
                    maxHeight={120}
                    minHeight={44}
                  />
                </Form.Item>
              </Form>
            </div>
          </Col>
        </Row>
      </Modal>
    </PageContainer>
  );
};

export default DispatchPage;
