import { View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'

import { AppText, Tag } from '@/components/atoms'
import { PageHeader, Card, ListItem } from '@/components/molecules'
import { useRequireAuth } from '@/utils/auth-guard'

/**
 * 部门详情（PR-1 占位 / PR-3 实装）
 *  - URL: /pages/system/dept/detail?id=1&name=研发部
 */
export default function DeptDetailPage() {
  useRequireAuth()
  const router = useRouter()
  const id = router.params.id
  const name = router.params.name

  return (
    <View className="page-container">
      <PageHeader title={name || '部门详情'} subtitle={`ID: ${id || '-'}`} />
      <View style={{ padding: '12px 16px' }}>
        <Card bordered padded>
          <View style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AppText size={15} weight="semibold">部门详情</AppText>
            <AppText size={13} variant="tertiary">
              三个 Tab：基本信息 / 部门成员 / 子部门
            </AppText>
            <View style={{ marginTop: 8 }}>
              <Tag variant="primary">PR-3 即将实装</Tag>
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 12 }}>
          <Card>
            <ListItem title="基本信息" showArrow={false} />
            <ListItem title="部门成员" showArrow={false} />
            <ListItem title="子部门" showArrow={false} bordered={false} />
          </Card>
        </View>
      </View>
    </View>
  )
}
