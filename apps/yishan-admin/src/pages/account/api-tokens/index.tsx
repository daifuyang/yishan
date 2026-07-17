import {
  CheckCircleFilled,
  CopyOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
} from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import {
  createMyApiToken,
  listMyApiTokens,
  revokeMyApiToken,
  listMyAvailableScopes,
  type ApiTokenDuration,
  type ApiTokenRecord,
  type AvailableScopeGroup,
} from '@/services/yishan-admin/api-token';

const DATE_FMT = 'YYYY-MM-DD HH:mm';

type FormValues = {
  name: string;
  duration: ApiTokenDuration;
  scopes: string[];
};

const DURATION_OPTIONS: { value: ApiTokenDuration; i18nKey: string }[] = [
  { value: '7d', i18nKey: 'account.apiTokens.createModal.duration.7d' },
  { value: '30d', i18nKey: 'account.apiTokens.createModal.duration.30d' },
  { value: '60d', i18nKey: 'account.apiTokens.createModal.duration.60d' },
  { value: '90d', i18nKey: 'account.apiTokens.createModal.duration.90d' },
  { value: '1y', i18nKey: 'account.apiTokens.createModal.duration.1y' },
  { value: 'never', i18nKey: 'account.apiTokens.createModal.duration.never' },
];

const ApiTokensPage: React.FC = () => {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const scopes = Form.useWatch<string[]>('scopes', form);

  // 可用权限范围（从 API 动态加载）
  const [availableScopeGroups, setAvailableScopeGroups] = useState<AvailableScopeGroup[]>([]);
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
      const res = await listMyApiTokens();
      if (res.success && res.data) {
        setTokens(res.data.list || []);
        return;
      }
      setTokens([]);
      message.error(res.message || t('account.apiTokens.error.list'));
    } catch (e: any) {
      setTokens([]);
      message.error(
        e?.message || t('account.apiTokens.error.list'),
      );
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
      const res = await listMyAvailableScopes();
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
    let values: FormValues;
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

  const doCreate = async (values: FormValues) => {
    setCreateLoading(true);
    try {
      const res = await createMyApiToken({
        name: values.name,
        duration: values.duration,
        scopes: values.scopes,
      });
      if (res.success && res.data) {
        setCreateOpen(false);
        setCreatedToken(res.data.token);
        setCopied(false);
        message.success(
          res.message ||
            t('account.apiTokens.createModal.submit'),
        );
        loadList();
        return;
      }
      message.error(
        res.message || t('account.apiTokens.error.create'),
      );
    } catch (e: any) {
      message.error(
        e?.message || t('account.apiTokens.error.create'),
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await revokeMyApiToken(id);
      if (res.success) {
        message.success(res.message || '撤销成功');
        loadList();
        return;
      }
      message.error(res.message || t('account.apiTokens.error.revoke'));
    } catch (e: any) {
      message.error(
        e?.message || t('account.apiTokens.error.revoke'),
      );
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
      width: 200,
      render: (scopes: string[] | null) => {
        if (!scopes?.length) {
          return (
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>
              {t('account.apiTokens.noScopes')}
            </span>
          );
        }
        const MAX_SHOW = 3;
        const shown = scopes.slice(0, MAX_SHOW);
        const remaining = scopes.length - MAX_SHOW;
        return (
          <Tooltip
            title={
              <div>
                {scopes.map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>
            }
          >
            <span>
              {shown.map((s) => {
                const isDanger = s === '*' || s === '__super_admin__';
                return (
                  <Tag key={s} color={isDanger ? 'error' : 'blue'} style={{ marginRight: 4 }}>
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
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title={t('account.apiTokens.revoke.confirm')}
          okText={t('account.apiTokens.revoke.ok')}
          cancelText={t('account.apiTokens.revoke.cancel')}
          okButtonProps={{ danger: true }}
          onConfirm={() => handleRevoke(record.id)}
        >
          <Button
            type="link"
            danger
            disabled={loading}
          >
            {t('account.apiTokens.revoke.ok')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer
      header={{
        title: t('account.apiTokens.title'),
        breadcrumb: {},
      }}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
        >
          {t('account.apiTokens.create')}
        </Button>,
      ]}
    >
      <Table<ApiTokenRecord>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={tokens}
        pagination={false}
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
        okButtonProps={{ loading: createLoading || scopesLoading, disabled: scopesError }}
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
              options={availableScopeGroups.map((group) => ({
                label: group.label,
                options: group.options.map((opt) => ({
                  value: opt.value,
                  label: opt.description ? (
                    <Tooltip title={opt.description}>
                      <span>{opt.label}</span>
                    </Tooltip>
                  ) : (
                    opt.label
                  ),
                })),
              }))}
              maxTagCount="responsive"
              showSearch
              tagRender={({ label, closable, onClose, value }) => {
                const tagColor = (value === '*' || value === '__super_admin__') ? 'error' : 'blue';
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
                const searchText = opt?.value ? searchTextMap[opt.value] ?? '' : '';
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
          let values: FormValues;
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
    </PageContainer>
  );
};

export default ApiTokensPage;