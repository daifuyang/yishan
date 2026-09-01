/**
 * CRM 客户公海页。
 *
 * 公海模式下默认隐藏手机号（mask）。
 * 认领成功后跳转到客户详情。
 */

import {
  type ActionType,
  PageContainer,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Space, Tag } from 'antd'
import React, { useRef } from 'react'
import { history } from '@umijs/max'
import { claimCustomer, listPool, maskPhone, type CustomerRow } from '@/services/crm'

const Pool: React.FC = () => {
  const actionRef = useRef<ActionType>(null)

  const handleClaim = async (id: number) => {
    await claimCustomer(id)
    message.success('已认领')
    actionRef.current?.reload()
    history.push(`/crm/customer-detail?id=${id}`)
  }

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 200,
      render: (_, r) => (
        <a onClick={() => history.push(`/crm/customer-detail?id=${r.id}`)}>{r.name}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      valueEnum: {
        enterprise: { text: '企业' },
        individual: { text: '个人' },
      },
    },
    {
      title: '电话',
      dataIndex: 'phone',
      width: 160,
      render: (_, r) => <span style={{ color: '#999' }}>{maskPhone(r.phone)}</span>,
    },
    { title: '行业', dataIndex: 'industry', width: 120 },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'poolStatus',
      width: 100,
      render: () => <Tag color="default">公海</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={16}>
          <a onClick={() => history.push(`/crm/customer-detail?id=${record.id}`)}>查看</a>
          <a onClick={() => handleClaim(record.id)}>
            <Button type="link" size="small">
              认领
            </Button>
          </a>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer
      header={{
        title: '客户公海',
        subTitle: '尚未被任何销售认领的客户；敏感联系方式已脱敏。',
      }}
    >
      <ProTable<CustomerRow>
        headerTitle="公海客户"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as Record<string, unknown>
          const res = await listPool({
            page: (current as number) ?? 1,
            pageSize: (pageSize as number) ?? 10,
            keyword: (rest.keyword as string) ?? '',
          })
          return {
            data: res.data,
            success: true,
            total: res.total,
          }
        }}
      />
    </PageContainer>
  )
}

export default Pool
