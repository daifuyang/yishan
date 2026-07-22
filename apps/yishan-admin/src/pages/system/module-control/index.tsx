import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components'
import {
  Badge,
  Button,
  Drawer,
  Space,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd'
import React, { useRef, useState } from 'react'
import {
  generateModuleControlMigration,
  listModuleControl,
  migrateModuleControl,
  seedModuleControl,
  toggleModuleControl,
} from '@/services/generated/moduleControl'

const DevModules: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [logTitle, setLogTitle] = useState('')
  const [logContent, setLogContent] = useState('')
  const [logOk, setLogOk] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openLog = (title: string, ok: boolean, stdout: string, stderr: string) => {
    setLogTitle(title)
    setLogOk(ok)
    setLogContent(
      [stdout, stderr].filter(Boolean).join('\n--- stderr ---\n') || '(无输出)',
    )
    setLogDrawerOpen(true)
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    setBusyId(id)
    try {
      const res = await toggleModuleControl({ id }, { enabled })
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

  const handleMigrate = async (id: string) => {
    setBusyId(id)
    try {
      const res = await migrateModuleControl({ id })
      const ok = Boolean(res.success && res.data?.success)
      if (ok) {
        message.success(res.message ?? '迁移完成')
        actionRef.current?.reload()
      } else {
        message.error(res.message ?? '迁移失败')
      }
      openLog(`迁移：${id}`, ok, res.data?.stdout ?? '', res.data?.stderr ?? '')
    } finally {
      setBusyId(null)
    }
  }

  const handleGenerate = async (id: string) => {
    setBusyId(id)
    try {
      const res = await generateModuleControlMigration({ id }, {})
      const ok = Boolean(res.success && res.data?.success)
      if (ok) {
        message.success(res.message ?? '已生成迁移文件')
        actionRef.current?.reload()
      } else {
        message.error(res.message ?? '生成失败')
      }
      openLog(`生成迁移：${id}`, ok, res.data?.stdout ?? '', res.data?.stderr ?? '')
    } finally {
      setBusyId(null)
    }
  }

  const handleSeed = async (id: string) => {
    setBusyId(id)
    try {
      const res = await seedModuleControl({ id })
      const ok = Boolean(res.success && res.data?.success)
      if (ok) {
        message.success(res.message ?? 'seed 完成')
      } else {
        message.error(res.message ?? 'seed 失败')
      }
      openLog(`seed：${id}`, ok, res.data?.stdout ?? '', res.data?.stderr ?? '')
    } finally {
      setBusyId(null)
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
    hasSchema: boolean
    hasDrizzle: boolean
    appliedMigrations: string[]
    pendingMigrations: string[]
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
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Switch
            size="small"
            checked={record.enabled}
            loading={busyId === record.id}
            onChange={(v) => handleToggle(record.id, v)}
          />
          <Tag color={record.enabled ? 'green' : 'default'}>
            {record.enabled ? '已启用' : '已停用'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '迁移进度',
      dataIndex: 'pendingMigrations',
      width: 280,
      render: (_, record) => {
        const total = record.appliedMigrations.length + record.pendingMigrations.length
        if (total === 0) return <span style={{ color: '#999' }}>无</span>
        return (
          <Space size={4}>
            <Tag color="green">{record.appliedMigrations.length}</Tag>
            <span style={{ color: '#999' }}>/</span>
            <Tooltip
              title={
                record.pendingMigrations.length > 0
                  ? `待执行：${record.pendingMigrations.join(', ')}`
                  : '无待执行'
              }
            >
              <Tag color={record.pendingMigrations.length > 0 ? 'red' : 'default'}>
                {record.pendingMigrations.length}
              </Tag>
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="link"
            disabled={!record.hasSchema || !record.hasDrizzle || busyId === record.id}
            onClick={() => handleGenerate(record.id)}
          >
            生成迁移
          </Button>
          <Button
            size="small"
            type="link"
            disabled={!record.hasDrizzle || busyId === record.id}
            onClick={() => handleMigrate(record.id)}
          >
            执行迁移
          </Button>
          <Button
            size="small"
            type="link"
            disabled={busyId === record.id}
            onClick={() => handleSeed(record.id)}
          >
            初始化数据
          </Button>
        </Space>
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
          const res = await listModuleControl()
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
      <Drawer
        title={logTitle}
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        width={720}
      >
        <Tag color={logOk ? 'green' : 'red'} style={{ marginBottom: 12 }}>
          {logOk ? '成功' : '失败'}
        </Tag>
        <pre
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            maxHeight: 480,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {logContent}
        </pre>
      </Drawer>
    </PageContainer>
  )
}

export default DevModules
