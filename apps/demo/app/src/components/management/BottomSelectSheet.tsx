import { ScrollView, Text, View } from '@tarojs/components'
import { LineIcon } from './LineIcon'
import styles from './BottomSelectSheet.module.scss'

export interface BottomSelectSheetProps {
  open: boolean
  title: string
  options: readonly { key: string; label: string }[]
  value: string
  onSelect: (key: string) => void
  onClose: () => void
}

export function BottomSelectSheet({
  open,
  title,
  options,
  value,
  onSelect,
  onClose,
}: BottomSelectSheetProps) {
  if (!open) return null
  return (
    <View className={styles.layer}>
      <View
        className={styles.mask}
        onClick={onClose}
        aria-label="取消选择"
        {...(process.env.TARO_ENV === 'h5' ? {} : { catchMove: true })}
      />
      <View className={styles.sheet}>
        <View className={styles.header}>
          <Text>{title}</Text>
          <View className={styles.close} onClick={onClose} aria-label="关闭选择">
            <LineIcon name="close" size={20} />
          </View>
        </View>
        <ScrollView scrollY className={styles.options}>
          {options.map((option) => (
            <View
              key={option.key || 'all'}
              className={`${styles.option} ${value === option.key ? styles.selected : ''}`}
              aria-label={option.label}
              aria-selected={value === option.key}
              onClick={() => {
                onSelect(option.key)
                onClose()
              }}
            >
              <Text>{option.label}</Text>
              {value === option.key ? <LineIcon name="check" size={18} color="#1677FF" /> : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}
