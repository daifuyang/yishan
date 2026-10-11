import { type ITouchEvent, Text, View } from '@tarojs/components'

import { LineIcon } from '@/components/icons'

import styles from './DangerAction.module.scss'

export interface DangerActionProps {
  children: React.ReactNode
  onClick?: (e: ITouchEvent) => void
}

export function DangerAction({ children, onClick }: DangerActionProps) {
  return (
    <View className={styles.action} hoverClass={styles.action_hover} hoverStayTime={50} onClick={onClick}>
      <LineIcon name="logOut" size={18} />
      <Text className={styles.action__text}>{children}</Text>
    </View>
  )
}

export default DangerAction
