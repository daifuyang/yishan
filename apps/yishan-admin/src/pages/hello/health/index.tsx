import { PageContainer } from '@ant-design/pro-components';
import { Alert, Card, Typography } from 'antd';
import React from 'react';

const HelloHealth: React.FC = () => (
  <PageContainer title="Hello 示例插件">
    <Card>
      <Typography.Paragraph>
        此页面随 main 分支发布，用于验证插件 manifest、动态菜单、权限和管理端路由的完整链路。
      </Typography.Paragraph>
      <Alert type="success" showIcon message="Hello 示例插件已加载" />
    </Card>
  </PageContainer>
);

export default HelloHealth;
