/**
 * API Token 管理页（账户中心 → API Token）。
 *
 * 之前一次性从仓库移除时被遗漏，导致 mako plugin 在模块全量构建时
 * 报 "找不到组件 ./account/api-tokens"。本文件提供最小占位实现：
 *   - 占位卡片：列出 PAT 的权限码名 + 后续扩展点
 *   - 真实实现：账户端 API Token CRUD（创建/吊销/查看）
 *
 * 数据接口：apps/yishan-api/src/core/routes/api/v1/me/api-tokens/
 *   - GET    /api/v1/me/api-tokens
 *   - POST   /api/v1/me/api-tokens
 *   - DELETE /api/v1/me/api-tokens/:id
 * 权限码：system:api-token:manage
 */
import { PageContainer, ProCard } from '@ant-design/pro-components'
import { Alert, Typography } from 'antd'
import React from 'react'

const { Paragraph } = Typography

const AccountApiTokens: React.FC = () => {
  return (
    <PageContainer header={{ title: 'API Token' }}>
      <ProCard
        title="API Token 管理"
        tooltip="个人访问令牌（PAT）— 用于外部集成"
        variant="outlined"
        styles={{ body: { padding: 24 } }}
      >
        <Alert
          showIcon
          type="info"
          message="本页面是占位实现：完整 CRUD（创建/吊销/查看）尚未集成。"
          style={{ borderRadius: 8, marginBottom: 16 }}
        />
        <Paragraph>
          后端接口已就绪：
        </Paragraph>
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
          }}
        >
{`GET    /api/v1/me/api-tokens
POST   /api/v1/me/api-tokens        # 创建 PAT（只返回一次明文）
DELETE /api/v1/me/api-tokens/:id`}
        </pre>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          权限码 <code>system:api-token:manage</code> 已绑定到该菜单的"管理"按钮节点。
        </Paragraph>
      </ProCard>
    </PageContainer>
  )
}

export default AccountApiTokens
