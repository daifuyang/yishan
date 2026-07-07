import { View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'

import { AppText, Tag } from '@/components/atoms'
import { PageHeader, Card, ListItem } from '@/components/molecules'
import { useRequireAuth } from '@/utils/auth-guard'

/**
 * 字典项列表（PR-1 占位 / PR-6 实装）
 *  - URL: /pages/system/dict/items?typeId=1&name=用户性别
 */
export default function DictItemsPage() {
  useRequireAuth()
  const router = useRouter()
  const typeId = router.params.typeId
  const name = router.params.name

  return (
    <View className="page-container">
      <PageHeader
        title={name || '字典项'}
        subtitle={typeId ? `typeId: ${typeId}` : ''}
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
              // TODO(PR-6): 打开新建字典项弹层
            }}
          >
            + 新建
          </View>
        }
      />
      <View style={{ padding: '12px 16px' }}>
        <Card bordered padded>
          <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AppText size={15} weight="semibold">字典项</AppText>
            <AppText size={13} variant="tertiary">
              列表：label / value / 是否默认 / 排序；支持编辑、删除。
            </AppText>
            <View style={{ marginTop: 8 }}>
              <Tag variant="primary">PR-6 即将实装</Tag>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 12 }}>
          <Card>
            <ListItem
              title="列表接口"
              value="GET /api/v1/admin/dicts/data?typeId="
              showArrow={false}
            />
            <ListItem
              title="移动端只读"
              value="GET /api/v1/app/dicts/:type"
              showArrow={false}
              bordered={false}
            />
          </Card>
        </View>
      </View>
    </View>
  )
}
