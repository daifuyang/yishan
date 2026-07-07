import { View } from '@tarojs/components'

import { AppText, Tag } from '@/components/atoms'
import { PageHeader, Card, ListItem } from '@/components/molecules'
import { TabBar } from '@/components/organisms'
import { useRequireAuth } from '@/utils/auth-guard'
import { TAB_PAGES } from '@/constants/routes'

/**
 * 字典管理 · 类型列表（PR-1 占位 / PR-6 实装）
 */
export default function DictIndexPage() {
  useRequireAuth()

  return (
    <View className="page-container">
      <PageHeader
        title="字典管理"
        subtitle="按类型分组"
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
              // TODO(PR-6): 打开新建字典类型弹层
            }}
          >
            + 新类型
          </View>
        }
      />
      <View style={{ padding: '12px 16px' }}>
        <Card bordered padded>
          <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AppText size={15} weight="semibold">字典管理</AppText>
            <AppText size={13} variant="tertiary">
              列表展示字典类型，点击进入字典项列表；支持 CRUD。
            </AppText>
            <View style={{ marginTop: 8 }}>
              <Tag variant="primary">PR-6 即将实装</Tag>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 12 }}>
          <Card>
            <ListItem
              title="类型列表"
              value="GET /api/v1/admin/dicts/types"
              showArrow={false}
            />
            <ListItem
              title="字典项列表"
              value="GET /api/v1/admin/dicts/data?typeId="
              showArrow={false}
            />
            <ListItem
              title="写权限"
              value="system:dict:write"
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
