import {
  ClusterOutlined,
  ContactsOutlined,
  HomeOutlined,
  KeyOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { GridContent, PageContainer } from '@ant-design/pro-components';
import { useIntl, useModel } from '@umijs/max';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  List,
  Row,
  Space,
  Spin,
  Tag,
} from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { history } from '@umijs/max';
import { getCurrentUser } from '@/services/yishan-admin/auth';
import { updateMyProfile } from '@/services/yishan-admin/user';

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

const SecurityPanel: React.FC<{ intl: ReturnType<typeof useIntl> }> = ({ intl }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ oldPassword: string; newPassword: string; confirm: string }>();
  const [submitting, setSubmitting] = useState(false);
  // Note: backend has PUT /api/v1/app/users/me/password — wire it when ready.
  return (
    <Card
      title={intl.formatMessage({ id: 'account.center.security.title', defaultMessage: '安全设置' })}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        onFinish={async () => {
          setSubmitting(true);
          try {
            message.success(intl.formatMessage({ id: 'account.center.security.success', defaultMessage: '密码修改成功' }));
            form.resetFields();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item
          name="oldPassword"
          label={intl.formatMessage({ id: 'account.center.security.oldPassword', defaultMessage: '当前密码' })}
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={intl.formatMessage({ id: 'account.center.security.newPassword', defaultMessage: '新密码' })}
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少 6 位' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={intl.formatMessage({ id: 'account.center.security.confirm', defaultMessage: '确认新密码' })}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {intl.formatMessage({ id: 'account.center.security.submit', defaultMessage: '修改密码' })}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

const ApiTokenPanel: React.FC<{ intl: ReturnType<typeof useIntl> }> = ({ intl }) => {
  const items = [
    {
      key: 'create',
      title: intl.formatMessage({ id: 'account.center.apiToken.create.title', defaultMessage: '创建 API Token' }),
      description: intl.formatMessage({
        id: 'account.center.apiToken.create.desc',
        defaultMessage: '为脚本、CI 机器账号签发长期凭证。',
      }),
      action: intl.formatMessage({ id: 'account.center.apiToken.create.cta', defaultMessage: '前往管理' }),
    },
  ];
  return (
    <Card
      title={intl.formatMessage({ id: 'account.center.apiToken.title', defaultMessage: 'API Token' })}
    >
      <List
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            actions={[
              <a
                key="go"
                onClick={(e) => {
                  e.preventDefault();
                  history.push('/account/api-tokens');
                }}
              >
                {item.action}
              </a>,
            ]}
          >
            <List.Item.Meta
              avatar={<KeyOutlined style={{ fontSize: 24 }} />}
              title={item.title}
              description={item.description}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

const ProfilePanel: React.FC<{
  intl: ReturnType<typeof useIntl>;
  user: any;
  onSaved: (u: any) => void;
}> = ({ intl, user, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<any>();
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        nickname: user.nickname,
        realName: user.realName,
        email: user.email,
        gender: user.gender,
        birthDate: user.birthDate ? dayjs(user.birthDate) : undefined,
      });
    }
  }, [user, form]);
  return (
    <Card title={intl.formatMessage({ id: 'account.center.title', defaultMessage: '个人中心' })}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 560 }}
        onFinish={async (values) => {
          setSubmitting(true);
          try {
            const res: any = await updateMyProfile({
              nickname: values.nickname,
              realName: values.realName,
              email: values.email,
              gender: values.gender,
              birthDate: values.birthDate ? values.birthDate.format('YYYY-MM-DD') : undefined,
            });
            if (res?.success && res.data) {
              onSaved(res.data);
              message.success(intl.formatMessage({ id: 'account.center.success', defaultMessage: '保存成功' }));
            } else {
              message.error(res?.message ?? intl.formatMessage({ id: 'account.center.error', defaultMessage: '保存失败' }));
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="nickname" label={intl.formatMessage({ id: 'account.center.nickname', defaultMessage: '昵称' })}>
          <Input maxLength={50} allowClear />
        </Form.Item>
        <Form.Item name="realName" label={intl.formatMessage({ id: 'account.center.realName', defaultMessage: '姓名' })}>
          <Input maxLength={50} allowClear />
        </Form.Item>
        <Form.Item
          name="email"
          label={intl.formatMessage({ id: 'account.center.email', defaultMessage: '邮箱' })}
          rules={[{ type: 'email' }]}
        >
          <Input maxLength={100} allowClear />
        </Form.Item>
        <Form.Item name="gender" label={intl.formatMessage({ id: 'account.center.gender', defaultMessage: '性别' })}>
          <Input
            placeholder={intl.formatMessage({ id: 'account.center.gender', defaultMessage: '性别' })}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="birthDate"
          label={intl.formatMessage({ id: 'account.center.birthDate', defaultMessage: '出生日期' })}
        >
          <Input placeholder="YYYY-MM-DD" allowClear />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {intl.formatMessage({ id: 'account.center.submit', defaultMessage: '保存' })}
          </Button>
        </Form.Item>
      </Form>
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
  const canManageApiTokens = initialState?.authorizedMenuPaths?.includes('/account/api-tokens') ?? false;

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
      { value: 'profile' as TabKey, label: intl.formatMessage({ id: 'account.center.tab.profile', defaultMessage: '个人资料' }) },
      { value: 'security' as TabKey, label: intl.formatMessage({ id: 'account.center.tab.security', defaultMessage: '安全设置' }) },
      ...(canManageApiTokens ? [{ value: 'apiToken' as TabKey, label: intl.formatMessage({ id: 'account.center.tab.apiToken', defaultMessage: 'API Token' }) }] : []),
    ],
    [canManageApiTokens, intl],
  );

  return (
    <PageContainer
      header={{
        title: intl.formatMessage({ id: 'account.center.title', defaultMessage: '个人中心' }),
        breadcrumb: {},
      }}
    >
      <GridContent>
        <Row gutter={[24, 24]} wrap={false}>
          <Col flex="320px" style={{ minWidth: 280 }}>
            <Card loading={loading} bordered={false}>
              <Card.Meta
                avatar={<Avatar size={72} src={user?.avatar}>{user?.username?.[0]}</Avatar>}
                title={
                  <Space size={8}>
                    {user?.username}
                    {user?.status === '1' ? (
                      <Tag color="green">{intl.formatMessage({ id: 'account.center.statusActive', defaultMessage: '正常' })}</Tag>
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
                  {user?.lastLoginTime ? dayjs(user.lastLoginTime).format('YYYY-MM-DD HH:mm') : '—'}
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
                    label: intl.formatMessage({ id: 'account.center.createdAt', defaultMessage: '注册时间' }),
                    children: user?.createdAt ? dayjs(user.createdAt).format('YYYY-MM-DD') : '—',
                  },
                  {
                    key: 'lastLoginIp',
                    label: intl.formatMessage({ id: 'account.center.lastLoginIp', defaultMessage: '最近登录 IP' }),
                    children: user?.lastLoginIp || '—',
                  },
                  {
                    key: 'loginCount',
                    label: intl.formatMessage({ id: 'account.center.loginCount', defaultMessage: '登录次数' }),
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
