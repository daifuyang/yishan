/**
 * 插件健康检查 — 调用后端 /api/demo/v1/info 展示模块与运行环境的只读信息。
 *
 * 通过 openapi 生成的 services 访问，类型与后端 schema 同步。
 */
import { PageContainer, ProCard, ProDescriptions } from '@ant-design/pro-components'
import { Alert, Space, Tag, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { demoV1Info } from '@/services/generated/demo'

const { Title, Paragraph } = Typography

interface ServerInfo {
  module: 'demo'
  nodeVersion: string
  hostname: string
  platform: string
  arch: string
  cpus: number
  memory: { total: number; free: number }
  uptimeSeconds: number
  pid: number
  env: string
  timestamp: string
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
    .filter(Boolean)
    .join(' ')
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(2)} ${units[unit]}`
}

const Health: React.FC = () => {
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await demoV1Info({})
      const data = (res as unknown as ServerInfo) ?? null
      if (data) {
        setInfo(data)
      } else {
        setError('请求失败')
      }
    } catch (e: any) {
      setError(e?.message ?? '请求失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfo()
  }, [])

  return (
    <PageContainer
      header={{
        title: '插件健康检查',
        subTitle: '调用 /api/demo/v1/info 验证模块运行时状态',
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          showIcon
          type="success"
          message="该接口对应后端 services/server-info.service.ts，是一个不读 db 的纯函数 service。"
        />
        {error && <Alert showIcon type="error" message={error} />}
        <ProCard
          loading={loading}
          title={
            <Space>
              <Title level={4} style={{ margin: 0 }}>
                运行时信息
              </Title>
              {info && <Tag color="processing">最近一次刷新 {info.timestamp}</Tag>}
            </Space>
          }
        >
          <ProDescriptions<ServerInfo>
            dataSource={info ?? undefined}
            columns={[
              { title: '模块', dataIndex: 'module' },
              { title: 'Node 版本', dataIndex: 'nodeVersion' },
              { title: '运行环境', dataIndex: 'env' },
              { title: '主机名', dataIndex: 'hostname' },
              { title: '平台 / 架构', dataIndex: ['platform'], render: (_, r) => `${r.platform} / ${r.arch}` },
              { title: 'CPU 核数', dataIndex: 'cpus' },
              { title: 'PID', dataIndex: 'pid' },
              {
                title: '运行时长',
                dataIndex: 'uptimeSeconds',
                render: (_, r) => formatUptime(r.uptimeSeconds),
              },
              {
                title: '内存 (total / free)',
                dataIndex: ['memory'],
                render: (_, r) => `${formatBytes(r.memory.total)} / ${formatBytes(r.memory.free)}`,
              },
            ]}
            column={2}
          />
        </ProCard>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          页面通过 openapi 生成的 services 调用后端，类型与字段随 schema 同步；不再直接拼 URL。
        </Paragraph>
      </Space>
    </PageContainer>
  )
}

export default Health
