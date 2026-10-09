import { MoreOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Dropdown, Space } from 'antd'
import React from 'react'

interface CustomerPageHeaderProps {
  onCreate: () => void
}

const CustomerPageHeader = ({ onCreate }: CustomerPageHeaderProps) => (
  <div className="customerWorkspaceHeader">
    <div>
      <h1>客户</h1>
      <p>集中管理客户资源，快速定位当前需要推进的工作。</p>
    </div>
    <Space wrap>
      <Button icon={<UploadOutlined />}>导入</Button>
      <Dropdown
        menu={{
          items: [
            { key: 'export', label: '导出当前结果', disabled: true },
            { key: 'saved-view', label: '保存为自定义视图（暂不可用）', disabled: true },
          ],
        }}
      >
        <Button aria-label="更多客户操作" icon={<MoreOutlined />} />
      </Dropdown>
      <Button type="primary" onClick={onCreate}>
        新建客户
      </Button>
    </Space>
  </div>
)

export default CustomerPageHeader
