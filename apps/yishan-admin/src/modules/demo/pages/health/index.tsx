/**
 * 插件健康检查 — 调用后端 /api/demo/v1/info 展示模块与运行环境的只读信息。
 *
 * 通过 openapi 生成的 services 访问，类型与后端 schema 同步。
 */
import { PageContainer, ProCard, ProDescriptions } from '@ant-design/pro-components'
import { ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Badge,
  Button,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  theme,
} from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { demoV1Info } from '@/services/generated/demo'

const { useToken } = theme

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

/** 将 Date 格式化为 YYYY-MM-DD HH:mm:ss（本地时区） */
function formatDateTime(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const Health: React.FC = () => {
  const { token } = useToken()
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null)

  const fetchInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await demoV1Info({})
      const data = (res as unknown as ServerInfo) ?? null
      if (data) {
        setInfo(data)
        setLastFetchAt(new Date())
      } else {
        setError('请求失败：后端未返回数据')
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

  const memoryUsedPct = useMemo(() => {
    if (!info) return 0
    const { total, free } = info.memory
    if (!total) return 0
    return Math.min(100, Math.max(0, ((total - free) / total) * 100))
  }, [info])

  const envBadge = useMemo(() => {
    if (!info) return { status: 'default' as const, text: '未知' }
    if (info.env === 'production') return { status: 'success' as const, text: '生产' }
    if (info.env === 'pre') return { status: 'warning' as const, text: '预发' }
    if (info.env === 'test') return { status: 'processing' as const, text: '测试' }
    return { status: 'processing' as const, text: '开发' }
  }, [info])

  return (
    <PageContainer
      header={{
        title: '插件健康检查',
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {error && <Alert showIcon type="error" message={error} />}

        <Row gutter={[16, 16]}>
          {[
            {
              key: 'module',
              title: '模块',
              valueNode: (
                <Statistic
                  title="模块"
                  value={info?.module ?? '—'}
                  prefix={<Badge status={envBadge.status} />}
                  valueStyle={{ fontSize: 22 }}
                />
              ),
              footer: (
                <div style={{ marginTop: 4 }}>
                  <Tag color={envBadge.status === 'success' ? 'success' : 'processing'}>
                    {envBadge.text}
                  </Tag>
                  <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    环境 {info?.env ?? '-'}
                  </span>
                </div>
              ),
            },
            {
              key: 'uptime',
              title: '运行时长',
              valueNode: (
                <Statistic
                  title="运行时长"
                  value={info ? formatUptime(info.uptimeSeconds) : '—'}
                  valueStyle={{ fontSize: 22 }}
                />
              ),
              footer: (
                <div style={{ marginTop: 4, color: token.colorTextSecondary, fontSize: 12 }}>
                  PID {info?.pid ?? '-'} · 主机 {info?.hostname ?? '-'}
                </div>
              ),
            },
            {
              key: 'cpu',
              title: 'CPU 核数',
              valueNode: (
                <Statistic
                  title="CPU 核数"
                  value={info?.cpus ?? 0}
                  suffix={info?.platform && info?.arch ? `${info.platform}/${info.arch}` : ''}
                  valueStyle={{ fontSize: 22 }}
                />
              ),
              footer: (
                <div style={{ marginTop: 4, color: token.colorTextSecondary, fontSize: 12 }}>
                  Node {info?.nodeVersion ?? '-'}
                </div>
              ),
            },
            {
              key: 'memory',
              title: '内存使用',
              valueNode: (
                <Statistic
                  title="内存使用"
                  value={info ? formatBytes(info.memory.total - info.memory.free) : '—'}
                  valueStyle={{ fontSize: 22 }}
                />
              ),
              extra: (
                <Progress
                  percent={Number(memoryUsedPct.toFixed(1))}
                  size="small"
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              ),
              footer: (
                <div style={{ marginTop: 4, color: token.colorTextSecondary, fontSize: 12 }}>
                  总计 {info ? formatBytes(info.memory.total) : '-'} · 空闲{' '}
                  {info ? formatBytes(info.memory.free) : '-'}
                </div>
              ),
            },
          ].map((card) => (
            <Col key={card.key} xs={24} sm={12} lg={6}>
              <ProCard style={{ borderRadius: 10, height: 144 }}>
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {card.valueNode}
                  {card.extra}
                  {card.footer}
                </div>
              </ProCard>
            </Col>
          ))}
        </Row>

        <ProCard
          loading={loading}
          title={
            <Space>
              <span style={{ fontSize: 16, fontWeight: 600 }}>运行时信息</span>
              {info && lastFetchAt && (
                <Tag color="processing">最近一次刷新 {formatDateTime(lastFetchAt)}</Tag>
              )}
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchInfo}
              loading={loading}
            >
              刷新
            </Button>
          }
          style={{ borderRadius: 10 }}
        >
          <ProDescriptions<ServerInfo>
            dataSource={info ?? undefined}
            columns={[
              { title: '模块', dataIndex: 'module' },
              { title: 'Node 版本', dataIndex: 'nodeVersion' },
              { title: '运行环境', dataIndex: 'env' },
              { title: '主机名', dataIndex: 'hostname' },
              {
                title: '平台 / 架构',
                dataIndex: ['platform'],
                render: (_, r) => `${r.platform} / ${r.arch}`,
              },
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
                render: (_, r) =>
                  `${formatBytes(r.memory.total)} / ${formatBytes(r.memory.free)}`,
              },
            ]}
            column={2}
          />
        </ProCard>
      </Space>
    </PageContainer>
  )
}

export default Health