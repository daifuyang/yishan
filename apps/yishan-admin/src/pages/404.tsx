import { history, useIntl } from '@umijs/max';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Result } from 'antd';
import React from 'react';

const NoFoundPage: React.FC = () => (
  <PageContainer>
    <Card variant="borderless">
      <Result
        status="404"
        title="404"
        subTitle={useIntl().formatMessage({ id: 'pages.404.subTitle' })}
        extra={
          <Button type="primary" onClick={() => history.push('/')}>
            {useIntl().formatMessage({ id: 'pages.404.buttonText' })}
          </Button>
        }
      />
    </Card>
  </PageContainer>
);

export default NoFoundPage;
