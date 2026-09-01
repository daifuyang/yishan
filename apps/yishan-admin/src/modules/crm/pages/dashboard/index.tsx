/**
 * CRM 工作台。
 *
 * 顶部 6 个计数器；
 * 待跟进客户 / 最近动态 两个列表。
 */

import { PageContainer } from '@ant-design/pro-components'
import { Card, Col, Empty, Row, Space, Statistic, Tag, Timeline } from 'antd'
import React, { useEffect, useState } from 'react'
import { history } from '@umijs/max'
import { getDashboard, type DashboardData } from '@/services/crm'

const TYPE_LABEL: Record<string, string> = {
  phone: '电话',
  wechat: '微信',
  visit: '拜访',
  meeting: '会议',
  email: '邮件',
  other: '其他',
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getDashboard()
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return (
    <PageContainer
      header={{
        title: 'CRM 工作台',
        subTitle: '登录后一眼看到今天该做什么。',
      }}
      loading={loading}
    >
      <Row gutter={16}>
        <Col span={4}>
          <Card>
            <Statistic title="我的客户" value={data?.counters.myCustomers ?? 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="待跟进"
              value={data?.counters.pendingFollowUp ?? 0}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="今日新增" value={data?.counters.todayNew ?? 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="公海客户" value={data?.counters.publicPool ?? 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="本周跟进" value={data?.counters.weekFollowUps ?? 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="本月新增" value={data?.counters.monthNew ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="待跟进客户">
            {data?.pendingFollowUps.length === 0 ? (
              <Empty description="暂无待跟进客户" />
            ) : (
              <Timeline
                items={(data?.pendingFollowUps ?? []).map((p) => ({
                  children: (
                    <div>
                      <a onClick={() => history.push(`/crm/customer-detail?id=${p.id}`)}>
                        {p.name}
                      </a>
                      <span style={{ color: '#999', marginLeft: 8 }}>
                        {p.ownerUserName ?? '—'}
                      </span>
                      {p.nextFollowUpAt && (
                        <div style={{ color: '#1890ff', marginTop: 4 }}>
                          计划跟进：{new Date(p.nextFollowUpAt).toLocaleString()}
                        </div>
                      )}
                      {p.statusName && (
                        <div style={{ marginTop: 4 }}>
                          <Tag>{p.statusName}</Tag>
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近动态">
            {data?.recentActivities.length === 0 ? (
              <Empty description="暂无动态" />
            ) : (
              <Timeline
                items={(data?.recentActivities ?? []).map((a) => ({
                  children: (
                    <div>
                      <Space>
                        <Tag color="blue">{TYPE_LABEL[a.type] ?? a.type}</Tag>
                        <strong>{a.operatorUserName ?? `用户`}</strong>
                        <a onClick={() => history.push(`/crm/customer-detail?id=${a.customerId}`)}>
                          {a.customerName}
                        </a>
                      </Space>
                      <div style={{ color: '#999', marginTop: 2 }}>
                        {new Date(a.occurredAt).toLocaleString()}
                      </div>
                      <div style={{ marginTop: 4 }}>{a.summary}</div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>
    </PageContainer>
  )
}

export default Dashboard
