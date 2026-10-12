/**
 * 快速入门 — 按 API V2 模块契约从零搭建一个业务模块。
 *
 * 五个步骤的标题与移动端 `apps/demo/app/src/pages/demo/quickstart` 保持一致；
 * PC 端在正文里补充真实路径与命令。架构依据见
 * `docs/architecture/api-v2.md`、`package-boundaries.md`、`database-ownership.md`
 * 以及 `apps/demo/api/src/modules/demo/README.md`，契约变化时同步修改本页。
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
    title: '定义模块',
    body: (
      <>
        模块使用独立 ID，<Text code>module.ts</Text> 声明公开模块契约；业务表以模块 ID 为前缀。
        在 <CodeBlock>apps/demo/api/src/modules/&lt;id&gt;/module.ts</CodeBlock>
        默认导出 <Text code>ApiModule&lt;SystemRuntime&gt;</Text>：
        <Text code>contractVersion: 2</Text>、<Text code>id</Text> / <Text code>version</Text>
        元数据、<Text code>tablePrefix: &apos;&lt;id&gt;_&apos;</Text>、对 <Text code>system</Text>{' '}
        的依赖声明、<Text code>register</Text>（挂载路由）、<Text code>migrations</Text>
        （独立 <Text code>drizzle/</Text> 目录与 <Text code>__drizzle_migrations_&lt;id&gt;</Text>{' '}
        历史表）以及可选的 <Text code>seed</Text>。Core 校验契约并按依赖拓扑排序，不扫描目录。
        <CodeBlock>
          {[
            'module.ts            # ApiModule 契约',
            'db/schema.ts         # <id>_ 前缀业务表',
            'drizzle.config.ts    # 模块自有迁移配置',
            'drizzle/             # 迁移 SQL + meta/_journal.json',
            'routes/ services/ repositories/ schemas/ config/ tests/ seed.ts',
          ].join('\n')}
        </CodeBlock>
        表名前缀由 <Text code>pnpm lint</Text> 中的{' '}
        <Text code>scripts/check-module-naming.mjs</Text> 检查。
      </>
    ),
  },
  {
    tag: '02',
    title: '实现业务接口',
    body: (
      <>
        按 <Text code>routes → services → repositories → db/schema</Text>{' '}
        组织，集中声明请求校验和权限。<Text code>routes/v1/&lt;resource&gt;/index.ts</Text>{' '}
        由 autoload 映射为 <Text code>/api/&lt;id&gt;/v1/&lt;resource&gt;</Text>；路由在{' '}
        <Text code>schema</Text> 中挂 TypeBox 请求 / 响应 schema（<Text code>schemas/</Text>
        ，带 <Text code>$id</Text> 与 <Text code>operationId</Text>），在{' '}
        <Text code>access.permission</Text> 引用文件顶部集中定义的 <Text code>PERMS</Text>
        （例如 <Text code>demo:todos:list</Text>）。只有 repository 执行 SQL；模块不能访问{' '}
        <Text code>sys_*</Text> 表或 System 私有 repository，用户身份走公开用户目录。
        <CodeBlock>pnpm --filter @yishan/demo-api test</CodeBlock>
      </>
    ),
  },
  {
    tag: '03',
    title: '安装到产品',
    body: (
      <>
        产品的显式 manifest 决定安装模块，数据库启用状态决定已安装模块是否提供服务。
        把模块加入
        <CodeBlock>apps/demo/api/src/manifest.ts   # export const demoModules = [...]</CodeBlock>
        Admin 构建插件读取同一份 manifest，只编译已安装模块的{' '}
        <Text code>apps/demo/admin/src/modules/&lt;id&gt;/</Text> 页面。运行时流量由{' '}
        <Text code>sys_module.enabled</Text> 控制，可在模块管理页面启停。
        卸载模块即从 manifest 移除，不需要修改 Core。
      </>
    ),
  },
  {
    tag: '04',
    title: '配置页面与入口',
    body: (
      <>
        Web 与移动端分别实现页面，工作台配置选择已注册的移动页面，按角色授权。
        <CodeBlock>
          {[
            '# Web 页面，菜单 component 写 ./modules/<id>/<page>',
            'apps/demo/admin/src/modules/<id>/pages/<page>/index.tsx',
            'apps/demo/api/src/modules/<id>/config/system-menu.json',
            '',
            '# 移动页面，注册后工作台入口按 page 匹配',
            'apps/demo/app/src/pages/<id>/<page>/index.tsx',
            'apps/demo/app/src/modules/registry.ts',
            'apps/demo/api/src/modules/<id>/config/app-menu.json',
          ].join('\n')}
        </CodeBlock>
        模块 <Text code>seed.ts</Text> 通过 System 公开的 <Text code>seedModuleMenus</Text> /{' '}
        <Text code>seedModuleAppMenus</Text> 写入菜单；工作台入口在「系统管理 → 工作台管理」
        维护，并在角色表单的「App 工作台」页签授权。接口变化后用
        <CodeBlock>pnpm --filter @yishan/demo-admin openapi</CodeBlock>
        重新生成 Admin 客户端。
      </>
    ),
  },
  {
    tag: '05',
    title: '执行迁移与验证',
    body: (
      <>
        数据库迁移单独执行；验证接口契约、权限、错误恢复以及 Web 和移动端实际流程。
        应用启动不会迁移或运行 seed，写命令须在确认连接环境后显式执行：
        <CodeBlock>
          {[
            '# 在模块目录生成迁移（schema 变更后）',
            'cd apps/demo/api/src/modules/<id>',
            'npx drizzle-kit generate --config=./drizzle.config.ts',
            '',
            '# 回到仓库根目录',
            'pnpm build:api',
            'pnpm --filter @yishan/demo-api db:migrate --check     # 只检查文件与 journal',
            'pnpm --filter @yishan/demo-api db:migrate --dry-run   # 只读检查 pending',
            'pnpm --filter @yishan/demo-api db:migrate --apply     # 显式写入',
            'pnpm db:seed                                          # 显式 seed，不执行迁移',
          ].join('\n')}
        </CodeBlock>
        然后启动开发环境，走一遍 Web 与移动端的真实流程：
        <CodeBlock>{['pnpm dev:api', 'pnpm --filter @yishan/demo-admin dev'].join('\n')}</CodeBlock>
        已发布的迁移 SQL 不再修改，需要变更时追加新迁移。
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
          message="约定：模块通过公开契约接入产品，代码、迁移与菜单声明都在模块自己的目录里，Core 不会被修改。"
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
          <Link href="/demo/health">健康检查</Link>、{' '}
          <Link href="/demo/todos">Todo 示例</Link> 与{' '}
          <Link href="/demo/region">省市级联示例</Link>。
        </Paragraph>
      </Space>
    </PageContainer>
  )
}

export default Quickstart
