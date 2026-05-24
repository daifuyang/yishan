import { PageContainer } from '@ant-design/pro-components';
import { Alert, Card, Col, Row, Statistic, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { getHelloAdminHealth } from '@/services/yishan-admin/helloModule';

const { Paragraph, Text, Title } = Typography;

interface HealthData {
  module: string;
  status: string;
  time: string;
}

const HelloHealth: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    getHelloAdminHealth()
      .then((res) => {
        if (res.success && res.data) {
          setHealth(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageContainer title="Hello 插件 Quick Start">
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>目标</Title>
        <Paragraph>
          通过 <Text code>hello</Text> 模块，快速完成一个可运行插件：包含后端 manifest、路由、鉴权、前端页面与菜单接入。
        </Paragraph>
        <Alert
          type="info"
          showIcon
          message="建议先复制 hello 目录作为模板，再逐步替换模块名和业务字段。"
        />
      </Card>

      <Card title="1) 创建模块目录" style={{ marginBottom: 16 }}>
        <Paragraph>
          在 <Text code>apps/yishan-api/src/plugins/modules</Text> 下创建你的模块目录，最小结构如下：
        </Paragraph>
        <Paragraph>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{`src/plugins/modules/<module>/
├── manifest.ts
├── routes/
│   └── v1/
│       ├── index.ts
│       └── admin/
│           ├── autohooks.ts
│           └── index.ts
├── schemas/
├── services/
└── test/
    └── routes.test.ts`}</pre>
        </Paragraph>
      </Card>

      <Card title="2) 编写后端 manifest.ts" style={{ marginBottom: 16 }}>
        <Paragraph>
          参考 <Text code>apps/yishan-api/src/plugins/modules/hello/manifest.ts</Text>，至少包含以下关键字段：
        </Paragraph>
        <Paragraph>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{`export default {
  pluginId: 'org/your-plugin',
  name: 'your-plugin',
  version: '1.0.0',
  coreCompatibility: '^1.0.0',
  channels: ['admin', 'public'],
  routeBase: '/api/modules/org/your-plugin/v1',
  permissions: ['your:health:read'],
  menus: [{ channel: 'admin', path: '/plugins/org/your-plugin/health', name: 'Your Plugin', perm: 'your:health:read' }],
  routes: [{ path: '/plugins/org/your-plugin/health', component: './your-plugin/health', access: 'canDo' }],
} as const;`}</pre>
        </Paragraph>
      </Card>

      <Card title="3) 实现路由和鉴权" style={{ marginBottom: 16 }}>
        <Paragraph>
          - 公开接口放在 <Text code>routes/v1/index.ts</Text>
          <br />- 管理接口放在 <Text code>routes/v1/admin</Text>
          <br />- 在 <Text code>admin/autohooks.ts</Text> 统一挂载 <Text code>fastify.authenticate</Text>
          <br />- 统一使用 <Text code>ResponseUtil.success</Text> 返回
        </Paragraph>
        <Paragraph>
          详细规范可查看 <Text code>apps/yishan-api/docs/模块化开发规范.md</Text>。
        </Paragraph>
      </Card>

      <Card title="4) 接入前端路由与页面" style={{ marginBottom: 16 }}>
        <Paragraph>
          在 <Text code>apps/yishan-admin/src/plugins/modules/your-plugin.manifest.ts</Text> 中配置页面路由，并创建页面组件。
        </Paragraph>
        <Paragraph>
          hello 示例：<Text code>apps/yishan-admin/src/plugins/modules/hello.manifest.ts</Text> 与{' '}
          <Text code>apps/yishan-admin/src/pages/hello/health/index.tsx</Text>。
        </Paragraph>
      </Card>

      <Card title="5) 验证与联调" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Paragraph>
              最少覆盖三类测试：
              <br />- 公开接口成功
              <br />- 鉴权成功
              <br />- 鉴权失败（401）
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Paragraph>
              常用命令：
              <br />- <Text code>pnpm --filter yishan-api test</Text>
              <br />- <Text code>pnpm --filter yishan-admin lint</Text>
              <br />- <Text code>pnpm --filter yishan-admin openapi</Text>
            </Paragraph>
          </Col>
        </Row>
      </Card>

      <Card title="运行状态（hello 示例）" loading={loading}>
        <Statistic title="Module" value={health?.module ?? '-'} style={{ marginBottom: 24 }} />
        <Statistic
          title="Status"
          value={health?.status ?? '-'}
          valueStyle={{ color: health?.status === 'ok' ? '#3f8600' : '#cf1322' }}
          style={{ marginBottom: 24 }}
        />
        <Text type="secondary">Time: {health?.time ?? '-'}</Text>
      </Card>
    </PageContainer>
  );
};

export default HelloHealth;
