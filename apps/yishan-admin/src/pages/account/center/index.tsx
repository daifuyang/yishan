import {
  CheckCircleFilled,
  ClusterOutlined,
  ContactsOutlined,
  CopyOutlined,
  HomeOutlined,
  LockOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { GridContent, PageContainer } from '@ant-design/pro-components';
import { useIntl, useModel } from '@umijs/max';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AttachmentImageSelect } from '@/components/AttachmentSelect';
import { ImageCropperModal } from '@/components';
import { getCurrentUser } from '@/services/generated/auth';
import {
  appChangeMyPassword,
  appUpdateMe,
} from '@/services/generated/appUsers';
import {
  meCreateApiToken,
  meListApiTokens,
  meRevokeApiToken,
  meListAvailableScopes,
} from '@/services/generated/meApiTokens';
import { logout } from '@/utils/auth';

const DATE_FMT = 'YYYY-MM-DD HH:mm';

type ApiTokenDurationValue = '7d' | '30d' | '60d' | '90d' | '1y' | 'never';

type ApiTokenFormValues = {
  name: string;
  duration: ApiTokenDurationValue;
  scopes: string[];
};

type AvailableScopeGroup = API.availableScopeGroup;

type ApiTokenRecord = API.apiTokenRecord;

const DURATION_OPTIONS: { value: ApiTokenDurationValue; i18nKey: string }[] = [
  { value: '7d', i18nKey: 'account.apiTokens.createModal.duration.7d' },
  { value: '30d', i18nKey: 'account.apiTokens.createModal.duration.30d' },
  { value: '60d', i18nKey: 'account.apiTokens.createModal.duration.60d' },
  { value: '90d', i18nKey: 'account.apiTokens.createModal.duration.90d' },
  { value: '1y', i18nKey: 'account.apiTokens.createModal.duration.1y' },
  { value: 'never', i18nKey: 'account.apiTokens.createModal.duration.never' },
];

const useStyles = createStyles(({ token }) => {
  return {
    detail: {
      margin: '16px 0',
      '& p': {
        marginBottom: 8,
        color: token.colorTextSecondary,
      },
      '& p:last-child': {
        marginBottom: 0,
      },
    },
    tagsTitle: {
      marginBottom: 8,
      color: token.colorTextSecondary,
      fontSize: token.fontSizeSM,
    },
    listItemMeta: {
      alignItems: 'center' as const,
    },
  };
});

type TabKey = 'profile' | 'security' | 'apiToken';

// 与后端 schema 保持一致：必须含字母和数字，长度 ≥ 6
const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/;

const SecurityPanel: React.FC<{ intl: ReturnType<typeof useIntl> }> = ({
  intl,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    oldPassword: string;
    newPassword: string;
    confirm: string;
  }>();
  const [submitting, setSubmitting] = useState(false);
  const t = (id: string, defaultMessage?: string) =>
    intl.formatMessage({ id, defaultMessage });
  return (
    <Card title={t('account.center.security.title', '安全设置')}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        onFinish={async (values) => {
          setSubmitting(true);
          try {
            const res: any = await appChangeMyPassword({
              oldPassword: values.oldPassword,
              newPassword: values.newPassword,
            });
            if (res?.success) {
              message.success(
                t('account.center.security.success', '密码已修改，请重新登录'),
              );
              form.resetFields();
              // 后端已在同一事务内撤销该用户所有 token；前端清掉本地会话并跳登录页
              await logout(true);
              return;
            }
            message.error(
              res?.message ??
                t('account.center.security.error', '密码修改失败'),
            );
          } catch (e: any) {
            message.error(
              e?.message ?? t('account.center.security.error', '密码修改失败'),
            );
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item
          name="oldPassword"
          label={t('account.center.security.oldPassword')}
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="current-password"
          />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t('account.center.security.newPassword')}
          rules={[
            { required: true, message: '请输入新密码' },
            {
              pattern: PASSWORD_PATTERN,
              message: '密码至少 6 位，且必须包含字母和数字',
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t('account.center.security.confirm')}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value)
                  return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('account.center.security.submit')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

const ApiTokenPanel: React.FC<{ intl: ReturnType<typeof useIntl> }> = ({
  intl,
}) => {
  const { message } = App.useApp();
  const t = (id: string, defaultMessage?: string) =>
    intl.formatMessage({ id, defaultMessage });

  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm<ApiTokenFormValues>();
  const scopes = Form.useWatch<string[]>('scopes', form);

  // 可用权限范围（从 API 动态加载）
  const [availableScopeGroups, setAvailableScopeGroups] = useState<
    AvailableScopeGroup[]
  >([]);
  const [scopesLoading, setScopesLoading] = useState(false);
  const [scopesError, setScopesError] = useState(false);
  const [confirmEmptyScopesOpen, setConfirmEmptyScopesOpen] = useState(false);

  // Build search text lookup: value -> plain text for filtering
  const searchTextMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of availableScopeGroups) {
      for (const opt of group.options) {
        map[opt.value] = opt.label;
      }
    }
    return map;
  }, [availableScopeGroups]);

  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await meListApiTokens();
      if (res.success && res.data) {
        setTokens(res.data.list || []);
        return;
      }
      setTokens([]);
      message.error(res.message || t('account.apiTokens.error.list'));
    } catch (e: any) {
      setTokens([]);
      message.error(e?.message || t('account.apiTokens.error.list'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleOpenCreate = async () => {
    form.resetFields();
    form.setFieldsValue({ duration: '30d', scopes: [] });
    setScopesError(false);

    // 从 API 加载当前用户可授予的权限范围
    setScopesLoading(true);
    try {
      const res = await meListAvailableScopes();
      if (res.success && res.data) {
        setAvailableScopeGroups(res.data.groups || []);
      } else {
        setAvailableScopeGroups([]);
        setScopesError(true);
        message.error(res.message || '加载权限范围失败');
      }
    } catch (e: any) {
      setAvailableScopeGroups([]);
      setScopesError(true);
      message.error(e?.message || '加载权限范围失败');
    } finally {
      setScopesLoading(false);
    }

    setCreateOpen(true);
  };

  const handleCreate = async () => {
    let values: ApiTokenFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    // 空 scopes 二次确认
    if (!values.scopes?.length) {
      setConfirmEmptyScopesOpen(true);
      return;
    }

    await doCreate(values);
  };

  const doCreate = async (values: ApiTokenFormValues) => {
    setCreateLoading(true);
    try {
      const res = await meCreateApiToken({
        name: values.name,
        duration: values.duration as unknown as API.apiTokenDuration,
        scopes: values.scopes,
      });
      if (res.success && res.data) {
        setCreateOpen(false);
        setCreatedToken(res.data.token);
        setCopied(false);
        message.success(
          res.message || t('account.apiTokens.createModal.submit'),
        );
        loadList();
        return;
      }
      message.error(res.message || t('account.apiTokens.error.create'));
    } catch (e: any) {
      message.error(e?.message || t('account.apiTokens.error.create'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await meRevokeApiToken({ id });
      if (res.success) {
        message.success(res.message || '撤销成功');
        loadList();
        return;
      }
      message.error(res.message || t('account.apiTokens.error.revoke'));
    } catch (e: any) {
      message.error(e?.message || t('account.apiTokens.error.revoke'));
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      message.success(t('account.apiTokens.createdModal.copied'));
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = createdToken;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        message.success(t('account.apiTokens.createdModal.copied'));
      } catch {
        message.error('复制失败,请手动选中复制');
      }
      document.body.removeChild(ta);
    }
  };

  const isExpired = (iso: string | null) => {
    if (!iso) return false;
    return new Date(iso).getTime() < Date.now();
  };

  const columns: ColumnsType<ApiTokenRecord> = [
    {
      title: t('account.apiTokens.col.name'),
      dataIndex: 'name',
      key: 'name',
      width: 220,
    },
    {
      title: t('account.apiTokens.col.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => (v ? dayjs(v).format(DATE_FMT) : '—'),
    },
    {
      title: t('account.apiTokens.col.lastUsedAt'),
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 170,
      render: (v: string | null) =>
        v ? (
          dayjs(v).format(DATE_FMT)
        ) : (
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
            {t('account.apiTokens.neverUsed')}
          </span>
        ),
    },
    {
      title: t('account.apiTokens.col.lastUsedIp'),
      dataIndex: 'lastUsedIp',
      key: 'lastUsedIp',
      width: 140,
      render: (v: string | null) =>
        v ?? (
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
            {t('account.apiTokens.neverUsed')}
          </span>
        ),
    },
    {
      title: t('account.apiTokens.col.expiresAt'),
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 180,
      render: (v: string | null) => {
        if (!v) {
          return <Tag color="default">{t('account.apiTokens.never')}</Tag>;
        }
        const expired = isExpired(v);
        return (
          <span style={{ color: expired ? '#cf1322' : undefined }}>
            {dayjs(v).format(DATE_FMT)}
            {expired ? (
              <Tag color="red" style={{ marginLeft: 8 }}>
                已过期
              </Tag>
            ) : null}
          </span>
        );
      },
    },
    {
      title: t('account.apiTokens.col.scopes'),
      dataIndex: 'scopes',
      key: 'scopes',
      render: (scopeList: string[] | null) => {
        if (!scopeList?.length) {
          return (
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>
              {t('account.apiTokens.noScopes')}
            </span>
          );
        }
        const MAX_SHOW = 3;
        const shown = scopeList.slice(0, MAX_SHOW);
        const remaining = scopeList.length - MAX_SHOW;
        return (
          <Tooltip
            title={
              <div>
                {scopeList.map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>
            }
          >
            <span>
              {shown.map((s) => {
                const isDanger = s === '*' || s === '__super_admin__';
                return (
                  <Tag
                    key={s}
                    color={isDanger ? 'error' : 'blue'}
                    style={{ marginRight: 4 }}
                  >
                    {s}
                  </Tag>
                );
              })}
              {remaining > 0 && (
                <Tag style={{ marginRight: 4 }}>+{remaining}</Tag>
              )}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: t('account.apiTokens.col.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={16}>
          <Popconfirm
            title={t('account.apiTokens.revoke.confirm')}
            okText={t('account.apiTokens.revoke.ok')}
            cancelText={t('account.apiTokens.revoke.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleRevoke(record.id)}
          >
            <a
              aria-disabled={loading}
              onClick={(event) => {
                if (loading) event.preventDefault();
              }}
              style={{
                color: '#ff4d4f',
                pointerEvents: loading ? 'none' : undefined,
              }}
            >
              {t('account.apiTokens.revoke.ok')}
            </a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={intl.formatMessage({
        id: 'account.center.apiToken.title',
        defaultMessage: 'API Token',
      })}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
        >
          {t('account.apiTokens.create')}
        </Button>
      }
    >
      <Table<ApiTokenRecord>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tokens}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      {/* Create modal */}
      <Modal
        title={t('account.apiTokens.createModal.title')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={createLoading}
        okText={t('account.apiTokens.createModal.submit')}
        cancelText={t('account.apiTokens.createModal.cancel')}
        maskClosable={false}
        destroyOnHidden
        okButtonProps={{
          loading: createLoading || scopesLoading,
          disabled: scopesError,
        }}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ duration: '30d' }}
        >
          <Form.Item
            name="name"
            label={t('account.apiTokens.createModal.nameLabel')}
            rules={[
              {
                required: true,
                message: t('account.apiTokens.createModal.nameRule'),
              },
              { max: 100 },
            ]}
          >
            <Input
              maxLength={100}
              placeholder={t('account.apiTokens.createModal.namePlaceholder')}
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="duration"
            label={t('account.apiTokens.createModal.durationLabel')}
          >
            <Select
              options={DURATION_OPTIONS.map((opt) => ({
                value: opt.value,
                label: t(opt.i18nKey),
              }))}
            />
          </Form.Item>
          <Form.Item
            name="scopes"
            label={t('account.apiTokens.createModal.scopesLabel')}
            tooltip={t('account.apiTokens.createModal.scopesTooltip')}
          >
            <Select
              mode="multiple"
              placeholder={t('account.apiTokens.createModal.scopesPlaceholder')}
              loading={scopesLoading}
              options={availableScopeGroups.map(
                (group: AvailableScopeGroup) => ({
                  label: group.label,
                  options: group.options.map((opt: API.availableScopeItem) => ({
                    value: opt.value,
                    label: opt.description ? (
                      <Tooltip title={opt.description}>
                        <span>{opt.label}</span>
                      </Tooltip>
                    ) : (
                      opt.label
                    ),
                  })),
                }),
              )}
              maxTagCount="responsive"
              showSearch
              tagRender={({ label, closable, onClose, value }) => {
                const tagColor =
                  value === '*' || value === '__super_admin__'
                    ? 'error'
                    : 'blue';
                return (
                  <Tag
                    color={tagColor}
                    closable={closable}
                    onClose={onClose}
                    style={{ marginRight: 4 }}
                  >
                    {label}
                  </Tag>
                );
              }}
              filterOption={(input, option) => {
                // option may have React element labels; use searchTextMap to find plain text by value
                const opt = option as { value?: string };
                const searchText = opt?.value
                  ? (searchTextMap[opt.value] ?? '')
                  : '';
                return searchText.toLowerCase().includes(input.toLowerCase());
              }}
              onChange={() => {
                // Force re-render to update warning visibility
                form.validateFields(['scopes']);
              }}
            />
          </Form.Item>
          {!scopes?.length ? (
            <Alert
              type="warning"
              showIcon
              message={t('account.apiTokens.createModal.noScopesWarning')}
              style={{ marginBottom: 16 }}
            />
          ) : null}
        </Form>
      </Modal>

      {/* Empty scopes confirmation modal */}
      <Modal
        title={t('account.apiTokens.confirmEmptyScopes.title')}
        open={confirmEmptyScopesOpen}
        onCancel={() => setConfirmEmptyScopesOpen(false)}
        onOk={async () => {
          setConfirmEmptyScopesOpen(false);
          let values: ApiTokenFormValues;
          try {
            values = await form.validateFields();
          } catch {
            return;
          }
          await doCreate(values);
        }}
        okText={t('account.apiTokens.confirmEmptyScopes.ok')}
        cancelText={t('account.apiTokens.confirmEmptyScopes.cancel')}
        okButtonProps={{ danger: true }}
      >
        <Alert
          type="warning"
          showIcon
          message={t('account.apiTokens.confirmEmptyScopes.message')}
        />
      </Modal>

      {/* Created token disclosure modal */}
      <Modal
        title={t('account.apiTokens.createdModal.title')}
        open={!!createdToken}
        onCancel={() => {
          setCreatedToken(null);
          setCopied(false);
        }}
        width={720}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={
          <Button
            type="primary"
            onClick={() => {
              setCreatedToken(null);
              setCopied(false);
            }}
          >
            {t('account.apiTokens.createdModal.confirm')}
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message={t('account.apiTokens.createdModal.body')}
          />
          <div>
            <Typography.Text strong>API Token</Typography.Text>
            <Space.Compact block style={{ marginTop: 8 }}>
              <Input
                value={createdToken ?? ''}
                readOnly
                onClick={(event) => event.currentTarget.select()}
                aria-label="API Token"
                style={{ fontFamily: 'monospace' }}
              />
              <Button
                type="primary"
                icon={copied ? <CheckCircleFilled /> : <CopyOutlined />}
                onClick={handleCopy}
              >
                {copied
                  ? t('account.apiTokens.createdModal.copied')
                  : t('account.apiTokens.createdModal.copy')}
              </Button>
            </Space.Compact>
          </div>
          {copied ? (
            <Typography.Text type="success" aria-live="polite">
              <CheckCircleFilled style={{ marginRight: 6 }} />
              已复制到剪贴板，请妥善保存。
            </Typography.Text>
          ) : null}
        </Space>
      </Modal>
    </Card>
  );
};

const GENDER_OPTIONS: { value: '0' | '1' | '2'; label: string }[] = [
  { value: '0', label: '未知' },
  { value: '1', label: '男' },
  { value: '2', label: '女' },
];

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

const ProfilePanel: React.FC<{
  intl: ReturnType<typeof useIntl>;
  user: any;
  onSaved: (u: any) => void;
}> = ({ intl, user, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<any>();
  const [submitting, setSubmitting] = useState(false);
  // 头像裁切：异步拦截本地选图 → 弹窗 → resolve 出裁后 File
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cropResolveRef = useRef<((file: File | null) => void) | null>(null);
  const t = (id: string, defaultMessage?: string) =>
    intl.formatMessage({ id, defaultMessage });

  const avatarBeforeUpload = useCallback((file: File): Promise<File | null> => {
    if (!file.type.startsWith('image/')) {
      // 非图片不弹裁切，沿用原文件
      return Promise.resolve(file);
    }
    return new Promise<File | null>((resolve) => {
      cropResolveRef.current = resolve;
      setCropFile(file);
      setCropOpen(true);
    });
  }, []);

  const handleCropConfirm = useCallback((cropped: File) => {
    cropResolveRef.current?.(cropped);
    cropResolveRef.current = null;
    setCropOpen(false);
    setCropFile(null);
  }, []);

  const handleCropCancel = useCallback(() => {
    cropResolveRef.current?.(null);
    cropResolveRef.current = null;
    setCropOpen(false);
    setCropFile(null);
  }, []);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        avatar: user.avatar,
        nickname: user.nickname,
        realName: user.realName,
        email: user.email,
        gender: user.gender,
        birthDate: user.birthDate ? dayjs(user.birthDate) : undefined,
        phone: user.phone,
      });
    }
  }, [user, form]);
  return (
    <Card title={t('account.center.title', '个人中心')}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 560 }}
        onFinish={async (values) => {
          setSubmitting(true);
          try {
            const res: any = await appUpdateMe({
              nickname: values.nickname,
              realName: values.realName,
              email: values.email,
              gender: values.gender,
              birthDate: values.birthDate
                ? values.birthDate.format('YYYY-MM-DD')
                : undefined,
              phone: values.phone,
              avatar: values.avatar,
            });
            if (res?.success && res.data) {
              onSaved(res.data);
              message.success(t('account.center.success', '保存成功'));
            } else {
              message.error(
                res?.message ?? t('account.center.error', '保存失败'),
              );
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="avatar" label={t('account.center.avatar', '头像')}>
          <AttachmentImageSelect beforeUpload={avatarBeforeUpload} />
        </Form.Item>
        <Form.Item name="nickname" label={t('account.center.nickname', '昵称')}>
          <Input maxLength={50} allowClear />
        </Form.Item>
        <Form.Item name="realName" label={t('account.center.realName', '姓名')}>
          <Input maxLength={50} allowClear />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('account.center.email', '邮箱')}
          rules={[{ type: 'email' }]}
        >
          <Input maxLength={100} allowClear />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t('account.center.phone', '手机号')}
          rules={[
            { pattern: PHONE_PATTERN, message: '请输入合法的中国大陆手机号' },
          ]}
        >
          <Input maxLength={11} allowClear placeholder="请输入 11 位手机号" />
        </Form.Item>
        <Form.Item name="gender" label={t('account.center.gender', '性别')}>
          <Select
            allowClear
            placeholder={t('account.center.gender', '性别')}
            options={GENDER_OPTIONS}
          />
        </Form.Item>
        <Form.Item
          name="birthDate"
          label={t('account.center.birthDate', '出生日期')}
        >
          <DatePicker
            format="YYYY-MM-DD"
            style={{ width: '100%' }}
            placeholder="YYYY-MM-DD"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('account.center.submit', '保存')}
          </Button>
        </Form.Item>
      </Form>
      <ImageCropperModal
        open={cropOpen}
        file={cropFile}
        aspect={1}
        shape="round"
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
        onFileChange={setCropFile}
        title="修改头像"
      />
    </Card>
  );
};

const Center: React.FC = () => {
  const intl = useIntl();
  const { styles } = useStyles();
  const { initialState, setInitialState } = useModel('@@initialState');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('profile');
  const canManageApiTokens =
    initialState?.authorizedMenuPaths?.includes('/account/api-tokens') ?? false;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res: any = await getCurrentUser();
        if (alive && res?.success) setUser(res.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onSaved = (u: any) => {
    setUser(u);
    setInitialState((s: any) => ({ ...s, currentUser: u }));
  };

  const tabList = useMemo(
    () => [
      {
        value: 'profile' as TabKey,
        label: intl.formatMessage({
          id: 'account.center.tab.profile',
          defaultMessage: '个人资料',
        }),
      },
      {
        value: 'security' as TabKey,
        label: intl.formatMessage({
          id: 'account.center.tab.security',
          defaultMessage: '安全设置',
        }),
      },
      ...(canManageApiTokens
        ? [
            {
              value: 'apiToken' as TabKey,
              label: intl.formatMessage({
                id: 'account.center.tab.apiToken',
                defaultMessage: 'API Token',
              }),
            },
          ]
        : []),
    ],
    [canManageApiTokens, intl],
  );

  return (
    <PageContainer
      header={{
        title: intl.formatMessage({
          id: 'account.center.title',
          defaultMessage: '个人中心',
        }),
        breadcrumb: {},
      }}
    >
      <GridContent>
        <Row gutter={[24, 24]} wrap={false}>
          <Col flex="320px" style={{ minWidth: 280 }}>
            <Card loading={loading} bordered={false}>
              <Card.Meta
                avatar={
                  <Avatar size={72} src={user?.avatar}>
                    {user?.username?.[0]}
                  </Avatar>
                }
                title={
                  <Space size={8}>
                    {user?.username}
                    {user?.status === 1 ? (
                      <Tag color="green">
                        {intl.formatMessage({
                          id: 'account.center.statusActive',
                          defaultMessage: '正常',
                        })}
                      </Tag>
                    ) : (
                      <Tag>{user?.statusName}</Tag>
                    )}
                  </Space>
                }
                description={user?.realName || user?.nickname || '—'}
              />
              <div className={styles.detail}>
                <p>
                  <ContactsOutlined style={{ marginRight: 8 }} />
                  {user?.email || '—'}
                </p>
                <p>
                  <ClusterOutlined style={{ marginRight: 8 }} />
                  {user?.phone || '—'}
                </p>
                <p>
                  <HomeOutlined style={{ marginRight: 8 }} />
                  {user?.lastLoginTime
                    ? dayjs(user.lastLoginTime).format('YYYY-MM-DD HH:mm')
                    : '—'}
                </p>
              </div>
              <Descriptions
                column={1}
                size="small"
                colon={false}
                style={{ marginTop: 16 }}
                items={[
                  {
                    key: 'createdAt',
                    label: intl.formatMessage({
                      id: 'account.center.createdAt',
                      defaultMessage: '注册时间',
                    }),
                    children: user?.createdAt
                      ? dayjs(user.createdAt).format('YYYY-MM-DD')
                      : '—',
                  },
                  {
                    key: 'lastLoginIp',
                    label: intl.formatMessage({
                      id: 'account.center.lastLoginIp',
                      defaultMessage: '最近登录 IP',
                    }),
                    children: user?.lastLoginIp || '—',
                  },
                  {
                    key: 'loginCount',
                    label: intl.formatMessage({
                      id: 'account.center.loginCount',
                      defaultMessage: '登录次数',
                    }),
                    children: user?.loginCount ?? '—',
                  },
                ]}
              />
            </Card>
          </Col>
          <Col flex="auto">
            <Card
              bordered={false}
              tabList={tabList.map((t) => ({ key: t.value, tab: t.label }))}
              activeTabKey={tab}
              onTabChange={(key) => setTab(key as TabKey)}
              tabProps={{ size: 'middle' }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <Spin />
                </div>
              ) : tab === 'profile' ? (
                <ProfilePanel intl={intl} user={user} onSaved={onSaved} />
              ) : tab === 'security' ? (
                <SecurityPanel intl={intl} />
              ) : canManageApiTokens ? (
                <ApiTokenPanel intl={intl} />
              ) : null}
            </Card>
          </Col>
        </Row>
      </GridContent>
    </PageContainer>
  );
};

export default Center;
