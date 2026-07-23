/**
 * 快速入门 — 演示模块如何从零搭建。
 *
 * 内容由本页面维护，与后端 `apps/yishan-api/src/modules/demo/README.md`
 * 互为镜像。每次新增模块时把同样的要点复制过去即可。
 */
import { PageContainer, ProCard } from '@ant-design/pro-components'
import { Alert, Avatar, Space, theme, Typography } from 'antd'
import React from 'react'

const { Paragraph, Text, Link } = Typography
const { useToken } = theme

/** 把一行 shell/sql/path 渲染为带背景的代码块，长内容自动换行 */
const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre
    style={{
      margin: '8px 0',
      padding: '10px 12px',
      background: 'rgba(0, 0, 0, 0.04)',
      borderRadius: 6,
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflowX: 'auto',
    }}
  >
    {children}
  </pre>
)

const STEPS: Array<{ tag: string; title: string; body: React.ReactNode }> = [
  {
    tag: '01',
    title: '规划模块 ID',
    body: (
      <>
        选一个 <Text code>id</Text>，必须小写字母 / 数字 / 下划线，目录名与 ID 一致。
        路由 prefix 由 Core 硬约定为 <CodeBlock>/api/&lt;id&gt;</CodeBlock>，表名约定以
        <CodeBlock>&lt;id&gt;_</CodeBlock> 开头。
      </>
    ),
  },
  {
    tag: '02',
    title: '建目录骨架',
    body: (
      <>
        在 <CodeBlock>apps/yishan-api/src/modules/&lt;id&gt;/</CodeBlock> 下建：
        <CodeBlock>
          module.json      # id / build / version{'\n'}
          routes.ts        # 默认 Fastify 插件（meta + autoload 路由）{'\n'}
          routes/v1/*.ts   # 业务路由{'\n'}
          db/schema.ts     # + drizzle/0000_init.sql{'\n'}
          repositories/ services/ schemas/ tests/
        </CodeBlock>
      </>
    ),
  },
  {
    tag: '03',
    title: '前端页面',
    body: (
      <>
        在 <CodeBlock>apps/yishan-admin/src/modules/&lt;id&gt;/pages/&lt;page&gt;/index.tsx</CodeBlock>{' '}
        放 React 页面。路径约定 <CodeBlock>./modules/&lt;id&gt;/&lt;page&gt;</CodeBlock>，由后端菜单的
        <Text code>component</Text> 字段提供。
      </>
    ),
  },
  {
    tag: '04',
    title: '写菜单 Seed',
    body: (
      <>
        在 <CodeBlock>apps/yishan-api/src/modules/&lt;id&gt;/seed.ts</CodeBlock>{' '}
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
        <CodeBlock>pnpm --filter yishan-api db:seed:modules</CodeBlock>{' '}
        会依次执行 migrate → 模块 seed.ts → 写菜单。后端在 <Text code>sys_module</Text>{' '}
        表中维护 <Text code>enabled</Text> 字段，全局 onRequest gate 按{' '}
        <Text code>sys_module.enabled</Text> 拦截。
      </>
    ),
  },
  {
    tag: '06',
    title: '启 dev 验证',
    body: (
      <>
        <CodeBlock>
          pnpm --filter yishan-api dev{'\n'}
          pnpm --filter yishan-admin dev
        </CodeBlock>
        Admin 的 <Text code>require.context('@modules', ...)</Text> 在 Mako 编译期
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
        <CodeBlock>
          rm -rf apps/yishan-api/src/modules/&lt;id&gt;{'\n'}
          rm -rf apps/yishan-admin/src/modules/&lt;id&gt;
        </CodeBlock>
        即可完整卸载：API 路由、数据库迁移、Admin 页面一并消失，无需改 Core
        注册表或 routes.ts。
      </>
    ),
  },
]

const Quickstart: React.FC = () => {
  const { token } = useToken()
  return (
    <PageContainer
      header={{
        title: '快速入门',
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="约定：模块代码与菜单 seed 都放在模块自己的目录里，Core 不会被修改。"
          style={{ borderRadius: 8 }}
        />
        {STEPS.map((step, idx) => (
          <ProCard
            key={step.tag}
            title={
              <Space align="center" size={12}>
                <Avatar
                  shape="circle"
                  size={32}
                  style={{
                    background: token.colorPrimary,
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {step.tag}
                </Avatar>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{step.title}</span>
              </Space>
            }
            style={{
              marginBottom: idx === STEPS.length - 1 ? 0 : 16,
              borderRadius: 10,
              borderLeft: `4px solid ${token.colorPrimary}`,
            }}
          >
            {step.body}
          </ProCard>
        ))}
        <Paragraph type="secondary" style={{ margin: 0 }}>
          完整示例参见{' '}
          <Link href="/demo/health">健康检查</Link> 与{' '}
          <Link href="/demo/todos">Todo 示例</Link>。
        </Paragraph>
      </Space>
    </PageContainer>
  )
}

export default Quickstart