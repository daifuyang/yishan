/**
 * CRM 跟进记录列表页（按客户聚合）。
 *
 * 简化版：列出有跟进记录的客户 + 最近跟进时间 / 最近一次内容。
 * 后续可与 contact / customer 关联聚合。
 */

import { PageContainer } from '@ant-design/pro-components'
import { Empty } from 'antd'
import React, { useEffect, useState } from 'react'
import { history } from '@umijs/max'
import { getDashboard, type DashboardData } from '@/services/crm'

const Activities: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    getDashboard().then(setData).catch(() => undefined)
  }, [])

  return (
    <PageContainer header={{ title: '跟进记录' }}>
      {data?.recentActivities.length === 0 ? (
        <Empty description="暂无跟进记录" />
      ) : (
        <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
          {(data?.recentActivities ?? []).map((a) => (
            <div
              key={a.id}
              style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
              onClick={() => history.push(`/crm/customer-detail?id=${a.customerId}`)}
            >
              <div>
                <strong>{a.operatorUserName ?? `用户`}</strong>
                <span style={{ color: '#999', marginLeft: 8 }}>
                  {new Date(a.occurredAt).toLocaleString()}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                跟进客户：<a>{a.customerName}</a>
              </div>
              <div style={{ color: '#666', marginTop: 4 }}>{a.summary}</div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}

export default Activities
