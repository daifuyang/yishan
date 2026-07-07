import { View } from '@tarojs/components'

import { AppText, Tag } from '@/components/atoms'
import { PageHeader, Card, ListItem } from '@/components/molecules'
import { TabBar } from '@/components/organisms'
import { useRequireAuth } from '@/utils/auth-guard'
import { TAB_PAGES } from '@/constants/routes'

/**
 * 登录日志（PR-1 占位 / PR-2 实装）
 *  - 占位说明：列表 / 筛选 / 详情待 PR-2 实装
 */
export default function LoginLogPage() {
  useRequireAuth()

  return (
    <View className="page-container">
      <PageHeader title="登录日志" subtitle="按时间倒序" />
      <View style={{ padding: '12px 16px' }}>
        <Card bordered padded>
          <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AppText size={15} weight="semibold">登录日志</AppText>
            <AppText size={13} variant="tertiary">
              支持按用户名、状态、时间范围筛选；点击条目查看详情。
            </AppText>
            <View style={{ marginTop: 8 }}>
              <Tag variant="primary">PR-2 即将实装</Tag>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 12 }}>
          <Card>
            <ListItem
              title="接口"
              value="GET /api/v1/admin/system/login-logs"
              showArrow={false}
            />
            <ListItem
              title="权限"
              value="system:login-log:list"
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
