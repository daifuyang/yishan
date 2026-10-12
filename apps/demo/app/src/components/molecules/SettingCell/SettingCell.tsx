import { type ITouchEvent, Text, View } from '@tarojs/components'

import { LineIcon, type LineIconName } from '@/components/icons'

import styles from './SettingCell.module.scss'

export interface SettingCellProps {
  icon: LineIconName
  title: React.ReactNode
  onClick?: (e: ITouchEvent) => void
  showArrow?: boolean
  /** 右侧自定义内容（如开关），传入后不再显示箭头 */
  extra?: React.ReactNode
}

export function SettingCell({ icon, title, onClick, showArrow = true, extra }: SettingCellProps) {
  return (
    <View className={styles.cell} hoverClass={styles.cell_hover} hoverStayTime={50} onClick={onClick}>
      <LineIcon name={icon} size={20} className={styles.cell__icon} />
      <Text className={styles.cell__title}>{title}</Text>
      {extra ?? (showArrow ? <LineIcon name="chevronRight" size={16} className={styles.cell__arrow} /> : null)}
    </View>
  )
}

export default SettingCell
