import { GithubOutlined } from '@ant-design/icons'
import { DefaultFooter } from '@ant-design/pro-components'
import React from 'react'

const Footer: React.FC = () => {
  return (
    <DefaultFooter
      style={{
        background: 'none',
      }}
      copyright={`${new Date().getFullYear()} Powered by zerocmf`}
      links={[
        {
          key: 'docs',
          title: '使用文档',
          href: '/docs',
          blankTarget: true,
        },
        {
          key: 'github',
          title: <GithubOutlined />,
          href: 'https://github.com/zerocmf/yishan',
          blankTarget: true,
        },

        {
          key: 'openapi',
          title: 'OpenAPI',
          href: '/docs/api',
          blankTarget: true,
        },
      ]}
    />
  )
}

export default Footer