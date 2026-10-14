import { Button, ScrollView, Text, View } from '@tarojs/components'
import { DateField } from './DateField'
import { useState } from 'react'

import { LineIcon } from './LineIcon'
import {
  DATE_RANGE_PRESETS,
  dateRangePreset,
  validateDateRange,
  type DateRange,
} from './dateRange'

import styles from './DateRangeSheet.module.scss'

export interface DateRangeSheetProps {
  /** 弹层标题，如「筛选用户」「登录时间」。 */
  title: string
  /** 分组标题，如「创建时间」。 */
  heading: string
  startDate: string
  endDate: string
  /** 展示「不限/今天/近7天/近30天/自定义」快捷区间；关闭时两端日期始终可编辑。 */
  presets?: boolean
  /** 允许只填一端；默认要求两端都填。 */
  allowPartial?: boolean
  /** 未选择时的占位文案。 */
  placeholders?: { start?: string; end?: string }
  onConfirm: (range: DateRange) => void
  onClose: () => void
}

/**
 * 日期区间筛选弹层。草稿态由组件持有，确认后才回调。
 *
 * 与 BottomSelectSheet 不同，这里没有 open：父组件按需挂载，每次挂载都以
 * 当前筛选值作为草稿初值（已进入筛选时直接展开「自定义」）。
 */
export function DateRangeSheet({
  title,
  heading,
  startDate,
  endDate,
  presets = false,
  allowPartial = false,
  placeholders,
  onConfirm,
  onClose,
}: DateRangeSheetProps) {
  const [draft, setDraft] = useState({ startDate, endDate })
  const [preset, setPreset] = useState(startDate || endDate ? 'custom' : 'all')
  const [error, setError] = useState('')

  const showDates = !presets || preset === 'custom'
  // 选中原生日期选择器时以今天为基准，避免空值在小程序端无法打开
  const today = dateRangePreset('1')
  const startPlaceholder = placeholders?.start ?? (allowPartial ? '开始日期不限' : '开始日期')
  const endPlaceholder = placeholders?.end ?? (allowPartial ? '结束日期不限' : '结束日期')

  return (
    <View className={styles.layer}>
      <View
        className={styles.mask}
        onClick={onClose}
        aria-label="取消时间筛选"
        {...(process.env.TARO_ENV === 'h5' ? {} : { catchMove: true })}
      />
      <View className={styles.sheet}>
        <View className={styles.header}>
          <Text>{title}</Text>
          <View className={styles.close} onClick={onClose} aria-label={`关闭${title}`}>
            <LineIcon name="close" size={20} />
          </View>
        </View>
        <ScrollView scrollY className={styles.body}>
          <Text className={styles.heading}>{heading}</Text>
          {presets ? (
            <View className={styles.presets}>
              {DATE_RANGE_PRESETS.map((option) => (
                <View
                  key={option.key}
                  className={`${styles.preset} ${preset === option.key ? styles.selected : ''}`}
                  onClick={() => {
                    setPreset(option.key)
                    setError('')
                    if (option.key !== 'custom') setDraft(dateRangePreset(option.key))
                  }}
                >
                  <Text>{option.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {showDates ? (
            <View className={styles.dates}>
              <DateField
                value={draft.startDate || today.startDate}
                onChange={(next) => {
                  setDraft({ ...draft, startDate: next })
                  setError('')
                }}
              >
                <View className={styles.date}>{draft.startDate || startPlaceholder}</View>
              </DateField>
              <Text>至</Text>
              <DateField
                value={draft.endDate || today.endDate}
                onChange={(next) => {
                  setDraft({ ...draft, endDate: next })
                  setError('')
                }}
              >
                <View className={styles.date}>{draft.endDate || endPlaceholder}</View>
              </DateField>
            </View>
          ) : null}
          {error ? <Text className={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View className={styles.footer}>
          <Button
            className={styles.reset}
            onClick={() => {
              setDraft({ startDate: '', endDate: '' })
              setPreset('all')
              setError('')
            }}
          >
            重置
          </Button>
          <Button
            className={styles.confirm}
            onClick={() => {
              const message = validateDateRange(draft.startDate, draft.endDate, allowPartial)
              if (message) {
                setError(message)
                return
              }
              onConfirm(draft)
            }}
          >
            确定
          </Button>
        </View>
      </View>
    </View>
  )
}
