import { FormOutlined, BarChartOutlined, DashboardOutlined, LinkOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography, Space } from 'antd';
import React from 'react';

const { Title, Paragraph } = Typography;

interface WelcomeBoardProps {
  onCreate: (type: string) => void;
}

const WelcomeBoard: React.FC<WelcomeBoardProps> = ({ onCreate }) => {
  const cards = [
    {
      title: '新建普通表单',
      description: '数据收集、事件跟进',
      icon: <FormOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      type: 'FORM',
    },
    {
      title: '新建报表',
      description: '数据分析、报表展示',
      icon: <BarChartOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      type: 'REPORT',
    },
    {
      title: '新建大屏',
      description: '业务数字化酷炫大屏',
      icon: <DashboardOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      type: 'DASHBOARD',
    },
    {
      title: '添加外部链接',
      description: '从本站点链接到外部',
      icon: <LinkOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
      type: 'EXTERNAL_LINK',
    },
  ];

  return (
    <div style={{ padding: 48, textAlign: 'center', background: '#fff', height: '100%' }}>
      <Title level={3}>从创建第一个页面开始，构建应用</Title>
      <Paragraph type="secondary" style={{ marginBottom: 48 }}>
        表单、报表、展示页，从哪开始？
      </Paragraph>
      <Row gutter={[24, 24]} justify="center">
        {cards.map((card) => (
          <Col key={card.type} span={6} style={{ minWidth: 200 }}>
            <Card
              hoverable
              onClick={() => onCreate(card.type)}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px 0' }}>
                {card.icon}
                <div>
                  <Title level={5} style={{ marginBottom: 8 }}>{card.title}</Title>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {card.description}
                  </Paragraph>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default WelcomeBoard;
