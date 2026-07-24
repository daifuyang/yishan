/**
 * 示例 — ProFormRegionCascader 的两种用法。
 *
 * 两块独立展示，互不互斥：
 *   1. 懒加载（默认）：首屏只拉 31 省；展开下级时按需调
 *      GET /api/v1/admin/system/regions/?parentCode=<code>
 *   2. 整树（loadAll=true）：一次拉 ~3400 条全树；Cascader 内部自行展开
 *
 * 每块 ProFormRegionCascader 通过自己的 hook (useRegionExample) 维护 value 与 path
 * 回填：value 变化自动触发 /api/v1/admin/system/regions/path 查询；互不干扰。
 *
 * 数据来自 sys_region 表，由 apps/yishan-api/src/scripts/seed/modules/system-region.ts
 * 在 db:seed 时灌入；权限码：region:list / region:tree / region:path / region:read。
 */
import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProForm,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components'
import { Col, Form, Row, Space, Statistic, theme } from 'antd'
import React from 'react'
import { ProFormRegionCascader } from '@/components'
import { useRegionExample } from './useRegionExample'

const RegionExample: React.FC = () => {
  const { token } = theme.useToken()

  // page 顶层持一个 form 实例，并通过 Form.Provider 下发，使子组件内 hook 都能拿到
  const [form] = Form.useForm()

  // 两块独立状态：互不影响；同一 hook 各自实例化
  const lazy = useRegionExample(form, 'lazyArea')
  const full = useRegionExample(form, 'fullArea')

  /** 单卡描述列：value / 末级 code / 末级名称 / 回填路径 */
  type DescRow = { raw: string; leafCode: string; leafName: string; path: string }
  const columns: ProDescriptionsItemProps<DescRow>[] = [
    { title: 'value 数组', dataIndex: 'raw' },
    { title: '末级 code', dataIndex: 'leafCode' },
    { title: '末级名称', dataIndex: 'leafName' },
    { title: '回填路径', dataIndex: 'path' },
  ]

  return (
    <PageContainer
      header={{
        title: '省市级联示例',
        subTitle: 'ProFormRegionCascader：懒加载 vs 整树加载两种策略的可运行对照',
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* ── 顶部 stats ────────────────────────────────────────────── */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <ProCard style={{ borderRadius: 10 }}>
              <Statistic
                title="省级（roots）"
                value={31}
                suffix="个"
                valueStyle={{ color: token.colorPrimary }}
              />
            </ProCard>
          </Col>
          <Col xs={24} sm={8}>
            <ProCard style={{ borderRadius: 10 }}>
              <Statistic
                title="地级市"
                value={342}
                suffix="个"
                valueStyle={{ color: token.colorInfo }}
              />
            </ProCard>
          </Col>
          <Col xs={24} sm={8}>
            <ProCard style={{ borderRadius: 10 }}>
              <Statistic
                title="区/县级"
                value={3056}
                suffix="个"
                valueStyle={{ color: token.colorSuccess }}
              />
            </ProCard>
          </Col>
        </Row>

        {/* ── 两列对照：两块独立 ProForm（互不互斥） ─────────────────────── */}
        <Form.Provider>
          <ProForm
            form={form}
            layout="vertical"
            submitter={false}
          >
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <ProCard
                title="懒加载（默认）"
                subTitle="按需查询：~3 个 HTTP 请求"
                tooltip="loadAll=false；首屏只拉 31 省；展开下级时再调 /api/v1/admin/system/regions/?parentCode=&lt;code&gt;"
                variant="outlined"
                styles={{ body: { padding: 20 } }}
              >
                <ProFormRegionCascader
                  name="lazyArea"
                  label="所在地区"
                  placeholder="展开下级时按需请求后端"
                  extra="GET /api/v1/admin/system/regions/?parentCode=&lt;code&gt;"
                />
                <ProDescriptions
                  style={{ marginTop: 16 }}
                  dataSource={{
                    raw: JSON.stringify(lazy.value) || '—',
                    leafCode:
                      lazy.leafCode != null ? String(lazy.leafCode) : '—',
                    leafName: lazy.leafName,
                    path: lazy.pathText,
                  }}
                  columns={columns}
                  column={1}
                  size="small"
                />
              </ProCard>
            </Col>

            <Col xs={24} lg={12}>
              <ProCard
                title="整树加载"
                subTitle="一次拉全树：1 个 HTTP 请求"
                tooltip="loadAll=true；一次拉 ~3400 条到客户端"
                variant="outlined"
                styles={{ body: { padding: 20 } }}
              >
                <ProFormRegionCascader
                  name="fullArea"
                  label="所在地区"
                  placeholder="搜索任意省/市/区"
                  loadAll={true}
                  extra="GET /api/v1/admin/system/regions/tree?level=3"
                />
                <ProDescriptions
                  style={{ marginTop: 16 }}
                  dataSource={{
                    raw: JSON.stringify(full.value) || '—',
                    leafCode:
                      full.leafCode != null ? String(full.leafCode) : '—',
                    leafName: full.leafName,
                    path: full.pathText,
                  }}
                  columns={columns}
                  column={1}
                  size="small"
                />
              </ProCard>
            </Col>
          </Row>
        </ProForm>
        </Form.Provider>

        {/* ── 顶栏说明 — 数据流 & 性能差异 ─────────────────────────────── */}
        <ProCard
          title="对比两种策略"
          variant="outlined"
          style={{ borderRadius: 10 }}
          styles={{ body: { padding: 20 } }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Statistic title="懒加载策略" value="按需" suffix="/ HTTP 请求" />
              <div
                style={{
                  marginTop: 8,
                  color: token.colorTextSecondary,
                  fontSize: 13,
                }}
              >
                适合省级用户量很大、地域分布集中在少数省时；首屏 IO 极轻。
              </div>
            </Col>
            <Col xs={24} md={12}>
              <Statistic
                title="整树策略"
                value="1"
                suffix="个 HTTP 请求"
              />
              <div
                style={{
                  marginTop: 8,
                  color: token.colorTextSecondary,
                  fontSize: 13,
                }}
              >
                适合表单频繁提交、跨地区切换、网络稳定时；服务端一次给全树。
              </div>
            </Col>
          </Row>
        </ProCard>
      </Space>
    </PageContainer>
  )
}

export default RegionExample
