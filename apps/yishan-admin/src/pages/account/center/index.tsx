import {
  ClusterOutlined,
  ContactsOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { GridContent, PageContainer } from '@ant-design/pro-components';
import { useIntl, useModel } from '@umijs/max';
import { Avatar, Card, Col, Descriptions, Row, Space, Spin, Tag } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { authGetCurrentUser } from '@/services/generated/auth';
import { SecurityPanel } from './components/SecurityPanel';
import { ApiTokenPanel } from './components/ApiTokenPanel';
import { ProfilePanel } from './components/ProfilePanel';
import type { TabKey } from './types';

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
        const res: any = await authGetCurrentUser();
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
                    {user?.status === '1' ? (
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
