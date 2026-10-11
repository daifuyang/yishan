import { useState } from 'react'
import { Text, View } from '@tarojs/components'

import styles from './SelectionFooter.module.scss'
import { LineIcon } from './LineIcon'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export interface SelectionFooterItem {
  id: number
  label: string
  /** 从根到该节点的名称链，用于已选清单里消歧同名部门 */
  path: string[]
}

export interface SelectionFooterProps {
  count: number
  unit: string
  items: readonly SelectionFooterItem[]
  readonly?: boolean
  onCancel: () => void
  onConfirm: () => void
  onRemoveItem?: (id: number) => void
}

/** 底部固定操作条：已选计数（可展开清单）+ 取消 / 确定。 */
export function SelectionFooter({
  count,
  unit,
  items,
  readonly = false,
  onCancel,
  onConfirm,
  onRemoveItem,
}: SelectionFooterProps) {
  const [open, setOpen] = useState(false)
  const summary =
    count === 0 ? `未选择任何${unit.replace(/^个/, '')}` : `已选择 ${count} ${unit}`

  return (
    <View className={styles.footer}>
      {readonly || !open ? null : (
        <View className={styles.sheet}>
          {items.length === 0 ? (
            <Text className={styles.sheetEmpty}>{summary}</Text>
          ) : (
            items.map((item) => (
              <View key={item.id} className={styles.sheetRow}>
                <Text className={styles.sheetPath}>{item.path.join(' / ')}</Text>
                <Text className={styles.sheetLabel}>{item.label}</Text>
                {onRemoveItem ? (
                  <View
                    className={styles.sheetRemove}
                    aria-label={`移除-${item.label}`}
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <LineIcon name="close" size={14} color="#86909C" />
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}

      <View className={styles.bar}>
        {readonly ? (
          <Text className={styles.summary}>{summary}</Text>
        ) : (
          <View
            className={styles.summaryToggle}
            aria-label="已选清单"
            onClick={() => setOpen(!open)}
          >
            <Text className={styles.summary}>{summary}</Text>
            <LineIcon name={open ? 'chevronDown' : 'chevronRight'} size={14} color="#86909C" />
          </View>
        )}

        {readonly ? (
          <View
            className={cx(styles.action, styles['action--primary'])}
            aria-label="完成"
            onClick={onConfirm}
          >
            <Text>完成</Text>
          </View>
        ) : (
          <View className={styles.actions}>
            <View className={styles.action} aria-label="取消" onClick={onCancel}>
              <Text>取消</Text>
            </View>
            <View
              className={cx(styles.action, styles['action--primary'])}
              aria-label="确定"
              onClick={onConfirm}
            >
              <Text>确定</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}