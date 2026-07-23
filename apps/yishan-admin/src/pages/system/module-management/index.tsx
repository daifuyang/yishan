import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import { Badge, Switch, Tag, message } from 'antd'
import { history } from '@umijs/max'
import React, { useEffect, useRef, useState } from 'react'
import {
  listModuleManagement,
  toggleModuleManagement,
} from '@/services/generated/moduleManagement'

// 后台模块管理页面只做启停（list + toggle）。
// schema 生成 / migrate / seed 全部走 CLI（db:seed / npx drizzle-kit / db:reset），
// 不暴露 HTTP，避免 dev 工具被 prod 误用或多人同时点按钮写文件冲突。
// 三层防御：
//   1. 后端 app.ts 在 NODE_ENV=production 时整个 _dev/ 树不挂载
//   2. menu.service 用 devOnlyMenuIds 兜底隐藏菜单项
//   3. 本页面 prod 直接 replace 到 /404
if (process.env.NODE_ENV === 'production') {
  if (typeof window !== 'undefined' && window.location.pathname !== '/404') {
    window.location.replace('/404')
  }
}

interface RowItem {
  id: string
  name: string
  routePrefix: string
  tablePrefix: string
  version: string
  enabled: boolean
  mounted: boolean
}

const DevModules: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // 兜底：prod 下 render hook 一进来就 replace 到 /404。
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && window.location.pathname !== '/404') {
      history.replace('/404')
    }
  }, [])

  const handleToggle = async (id: string, enabled: boolean) => {
    setBusyId(id)
    try {
      const res = await toggleModuleManagement({ id }, { enabled })
      if (res.success && res.data) {
        message.success(`已${enabled ? '启用' : '停用'}：${id}（即时生效）`)
        actionRef.current?.reload()
      } else {
        message.error(res.message ?? '操作失败')
      }
    } finally {
      setBusyId(null)
    }
  }

  const columns: ProColumns<RowItem>[] = [
    { title: '模块 ID', dataIndex: 'id', width: 140 },
    { title: '版本', dataIndex: 'version', width: 90 },
    { title: '路由前缀', dataIndex: 'routePrefix', width: 160, copyable: true },
    { title: '表前缀', dataIndex: 'tablePrefix', width: 110 },
    {
      title: '挂载状态',
      dataIndex: 'mounted',
      width: 110,
      render: (_, record) =>
        record.mounted ? (
          <Badge status="success" text="已挂载" />
        ) : (
          <Badge status="default" text="未挂载" />
        ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      width: 110,
      render: (_, record) => (
        <Tag color={record.enabled ? 'green' : 'default'}>
          {record.enabled ? '已启用' : '已停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.enabled}
          loading={busyId === record.id}
          onChange={(v) => handleToggle(record.id, v)}
        />
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<RowItem>
        headerTitle="模块列表"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        options={{ reload: true, density: false }}
        request={async () => {
          const res = await listModuleManagement()
          const items = (res.data?.items ?? []) as RowItem[]
          return {
            data: items,
            success: res.success,
            total: items.length,
          }
        }}
        columns={columns}
        pagination={false}
      />
    </PageContainer>
  )
}

export default DevModules
