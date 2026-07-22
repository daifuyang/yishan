/**
 * 快速入门 — 演示模块如何从零搭建。
 *
 * 内容由本页面维护，与后端 `apps/yishan-api/src/modules/demo/README.md`
 * 互为镜像。每次新增模块时把同样的要点复制过去即可。
 */
import { PageContainer, ProCard } from '@ant-design/pro-components'
import { Alert, Space, Tag, Typography } from 'antd'
import React from 'react'

const { Title, Paragraph, Text, Link } = Typography

const STEPS: Array<{ tag: string; title: string; body: React.ReactNode }> = [
  {
    tag: '01',
    title: '规划模块 ID',
    body: (
      <>
        选一个 <Text code>id</Text>，必须小写字母 / 数字 / 下划线，目录名与 ID 一致。
        路由 prefix 由 Core 硬约定为 <Text code>/api/&lt;id&gt;</Text>，表名约定以
        <Text code>&lt;id&gt;_</Text> 开头。
      </>
    ),
  },
  {
    tag: '02',
    title: '建目录骨架',
    body: (
      <>
        在 <Text code>apps/yishan-api/src/modules/&lt;id&gt;/</Text> 下建：
        <ul>
          <li><Text code>module.json</Text>：id / build / version</li>
          <li><Text code>routes.ts</Text>：默认 Fastify 插件（meta + autoload 路由）</li>
          <li><Text code>routes/v1/*.ts</Text>：业务路由</li>
          <li><Text code>db/schema.ts</Text> + <Text code>drizzle/0000_init.sql</Text></li>
          <li><Text code>repositories/ services/ schemas/ tests/</Text></li>
        </ul>
      </>
    ),
  },
  {
    tag: '03',
    title: '前端页面',
    body: (
      <>
        在 <Text code>apps/yishan-admin/src/modules/&lt;id&gt;/pages/&lt;page&gt;/index.tsx</Text>{' '}
        放 React 页面。路径约定 <Text code>./modules/&lt;id&gt;/&lt;page&gt;</Text>，由后端菜单的
        <Text code>component</Text> 字段提供。
      </>
    ),
  },
  {
    tag: '04',
    title: '写菜单 Seed',
    body: (
      <>
        在 <Text code>apps/yishan-api/src/modules/&lt;id&gt;/seed.ts</Text>{' '}
        调 <Text code>seedMenus()</Text> 写入模块菜单。模块级权限码
        (例如 <Text code>demo:todos:list</Text>) 由路由层{' '}
        <Text code>registerPermissions()</Text> 顶层副作用注册。
      </>
    ),
  },
  {
    tag: '05',
    title: '跑迁移 + 入驻',
    body: (
      <>
        <Text code>pnpm --filter yishan-api db:seed:modules</Text>{' '}
        会依次执行 migrate → 模块 seed.ts → 写菜单。后端在{' '}
        <Text code>sys_module</Text> 表中维护 <Text code>enabled</Text> 字段，
        全局 onRequest gate 按 <Text code>sys_module.enabled</Text> 拦截。
      </>
    ),
  },
  {
    tag: '06',
    title: '启 dev 验证',
    body: (
      <>
        <Text code>pnpm --filter yishan-api dev</Text> +{' '}
        <Text code>pnpm --filter yishan-admin dev</Text>。Admin 的{' '}
        <Text code>require.context('@modules', ...)</Text> 在 Mako 编译期
        扫描 <Text code>apps/yishan-admin/src/modules/</Text>，运行时无需再次
        拼路径或读 manifest。
      </>
    ),
  },
  {
    tag: '07',
    title: '拆除模块',
    body: (
      <>
        <Text code>rm -rf apps/yishan-api/src/modules/&lt;id&gt; apps/yishan-admin/src/modules/&lt;id&gt;</Text>{' '}
        即可完整卸载：API 路由、数据库迁移、Admin 页面一并消失，无需改 Core
        注册表或 routes.ts。
      </>
    ),
  },
]

const Quickstart: React.FC = () => {
  return (
    <PageContainer>
      <ProCard>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>
            快速入门
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            按以下 7 步即可在 移山 平台中交付一个完整的业务模块。
          </Paragraph>
          <Alert
            showIcon
            type="info"
            message="约定：模块代码与菜单 seed 都放在模块自己的目录里，Core 不会被修改。"
          />
          <div>
            {STEPS.map((step) => (
              <ProCard
                key={step.tag}
                title={
                  <Space>
                    <Tag color="processing">{step.tag}</Tag>
                    <span>{step.title}</span>
                  </Space>
                }
                style={{ marginBottom: 12 }}
              >
                {step.body}
              </ProCard>
            ))}
          </div>
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            完整示例参见{' '}
            <Link href="/demo/health">健康检查</Link> 与{' '}
            <Link href="/demo/todos">Todo 示例</Link>。
          </Paragraph>
        </Space>
      </ProCard>
    </PageContainer>
  )
}

export default Quickstart
