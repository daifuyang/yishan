import { View } from '@tarojs/components'

import { AppText, Tag } from '@/components/atoms'
import { PageHeader, Card, ListItem } from '@/components/molecules'
import { TabBar } from '@/components/organisms'
import { useRequireAuth } from '@/utils/auth-guard'
import { TAB_PAGES } from '@/constants/routes'

/**
 * 部门管理 · 列表（PR-1 占位 / PR-3 实装）
 */
export default function DeptIndexPage() {
  useRequireAuth()

  return (
    <View className="page-container">
      <PageHeader
        title="部门管理"
        subtitle="树形结构"
        right={
          <View
            style={{
              padding: '0 12px',
              height: 28,
              lineHeight: '28px',
              borderRadius: 4,
              background: 'var(--color-primary-bg)',
              color: 'var(--color-primary)',
              fontSize: 12,
            }}
            onClick={() => {
              // TODO(PR-3): 打开新建子部门弹层
            }}
          >
            + 新建
          </View>
        }
      />
      <View style={{ padding: '12px 16px' }}>
        <Card bordered padded>
          <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AppText size={15} weight="semibold">部门管理</AppText>
            <AppText size={13} variant="tertiary">
              以树形展示；点击节点进入详情，详情页内含基本信息 / 部门成员 / 子部门三个 Tab。
            </AppText>
            <View style={{ marginTop: 8 }}>
              <Tag variant="primary">PR-3 即将实装</Tag>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 12 }}>
          <Card>
            <ListItem
              title="列表接口"
              value="GET /api/v1/admin/departments"
              showArrow={false}
            />
            <ListItem
              title="详情接口"
              value="GET /api/v1/admin/departments/:id"
              showArrow={false}
            />
            <ListItem
              title="部门成员"
              value="GET /api/v1/app/contacts/depts/:id/users"
              showArrow={false}
            />
            <ListItem
              title="写权限"
              value="system:dept:write"
              showArrow={false}
              bordered={false}
            />
          </Card>
        </View>
      </View>
      <TabBar currentPath={TAB_PAGES.apps} />
    </View>
  )
}
