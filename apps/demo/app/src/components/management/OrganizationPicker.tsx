import { Text, View } from '@tarojs/components'

import { formatOrgSummary, UNSET } from '@/pages/system/user/profileSections'
import styles from './OrganizationPicker.module.scss'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface OrganizationPickerProps {
  label: string
  /** 已选项 ID，任意层级均可 */
  ids: number[]
  /** id → 名称，由调用方解析后传入 */
  names: Map<number, string>
  className?: string
  onPress: () => void
}

/** 组织归属跳转行：展示已选项摘要，点击进入选择页。 */
export function OrganizationPicker({
  label,
  ids,
  names,
  className = '',
  onPress,
}: OrganizationPickerProps) {
  const summary = formatOrgSummary(ids, names)
  const empty = summary === UNSET
  return (
    <View
      className={cx(styles.orgRow, className)}
      hoverClass={styles['orgRow--hover']}
      onClick={onPress}
      aria-label={label}
    >
      <Text className={styles.orgLabel}>{label}</Text>
      <View className={styles.orgTail}>
        <Text className={cx(styles.orgValue, empty && styles['orgValue--muted'])}>
          {summary}
        </Text>
        <LineIcon name="chevronRight" size={16} color="#C9CDD4" />
      </View>
    </View>
  )
}