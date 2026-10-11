import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import { useState } from 'react'
import { BottomSelectSheet, LineIcon, ManagementSearchBar } from '@/components/management'
import {
  datePreset,
  USER_SORT_OPTIONS,
  USER_STATUS_OPTIONS,
  validateDateRange,
  type UserFilters,
} from './filters'
import styles from './UserFilters.module.scss'

const DATE_OPTIONS = [
  { key: 'all', label: '不限' },
  { key: '1', label: '今天' },
  { key: '7', label: '近7天' },
  { key: '30', label: '近30天' },
  { key: 'custom', label: '自定义' },
]

export function UserFilterBar({
  keyword,
  onKeywordChange,
  filters,
  onChange,
}: {
  keyword: string
  onKeywordChange: (value: string) => void
  filters: UserFilters
  onChange: (patch: Partial<UserFilters>) => void
}) {
  const [panel, setPanel] = useState<'status' | 'sort' | 'dates' | null>(null)
  const [draft, setDraft] = useState({ startDate: '', endDate: '' })
  const [preset, setPreset] = useState('all')
  const [error, setError] = useState('')
  const status =
    USER_STATUS_OPTIONS.find((option) => option.key === filters.status) ?? USER_STATUS_OPTIONS[0]
  const sort =
    USER_SORT_OPTIONS.find((option) => option.key === filters.sort) ?? USER_SORT_OPTIONS[0]
  const hasDates = Boolean(filters.startDate || filters.endDate)

  const openDates = () => {
    setDraft({ startDate: filters.startDate, endDate: filters.endDate })
    setPreset(hasDates ? 'custom' : 'all')
    setError('')
    setPanel('dates')
  }
  return (
    <View className={styles.filters}>
      <ManagementSearchBar
        value={keyword}
        onChange={onKeywordChange}
        placeholder="搜索用户名、姓名或邮箱"
      />
      <View className={styles.triggers}>
        {(
          [
            { key: 'status', label: status.label, active: Boolean(filters.status) },
            { key: 'sort', label: sort.label, active: filters.sort !== 'createdDesc' },
            { key: 'dates', label: hasDates ? '筛选 · 1' : '筛选', active: hasDates },
          ] as const
        ).map((item) => (
          <View
            key={item.key}
            className={`${styles.trigger} ${item.active || panel === item.key ? styles.active : ''}`}
            aria-label={item.label}
            aria-expanded={panel === item.key}
            onClick={() =>
              item.key === 'dates' ? openDates() : setPanel(panel === item.key ? null : item.key)
            }
          >
            <Text className={styles.triggerLabel}>{item.label}</Text>
            <LineIcon
              name="chevronDown"
              size={14}
              color={item.active || panel === item.key ? '#1677FF' : '#4E5969'}
            />
          </View>
        ))}
      </View>
      {hasDates ? (
        <View
          className={styles.summary}
          onClick={() => onChange({ startDate: '', endDate: '' })}
          aria-label="清除创建时间筛选"
        >
          <Text>
            {filters.startDate} 至 {filters.endDate} 创建
          </Text>
          <LineIcon name="close" size={14} color="#1677FF" />
        </View>
      ) : null}
      <BottomSelectSheet
        open={panel === 'status' || panel === 'sort'}
        title={panel === 'status' ? '用户状态' : '排序方式'}
        options={panel === 'status' ? USER_STATUS_OPTIONS : USER_SORT_OPTIONS}
        value={panel === 'status' ? filters.status : filters.sort}
        onSelect={(key) => onChange(panel === 'status' ? { status: key } : { sort: key })}
        onClose={() => setPanel(null)}
      />
      {panel === 'dates' ? (
        <View className={styles.layer}>
          <View
            className={styles.mask}
            onClick={() => setPanel(null)}
            aria-label="取消筛选"
            {...(process.env.TARO_ENV === 'h5' ? {} : { catchMove: true })}
          />
          <View className={styles.sheet}>
            <View className={styles.header}>
              <Text>筛选用户</Text>
              <View className={styles.close} onClick={() => setPanel(null)} aria-label="关闭筛选">
                <LineIcon name="close" size={20} />
              </View>
            </View>
            <ScrollView scrollY className={styles.body}>
              <Text className={styles.heading}>创建时间</Text>
              <View className={styles.presets}>
                {DATE_OPTIONS.map((option) => (
                  <View
                    key={option.key}
                    className={`${styles.preset} ${preset === option.key ? styles.selected : ''}`}
                    onClick={() => {
                      setPreset(option.key)
                      setError('')
                      if (option.key !== 'custom') setDraft(datePreset(option.key))
                    }}
                  >
                    <Text>{option.label}</Text>
                  </View>
                ))}
              </View>
              {preset === 'custom' ? (
                <View className={styles.dates}>
                  <Picker
                    mode="date"
                    value={draft.startDate || datePreset('1').startDate}
                    onChange={(event) => {
                      setDraft({ ...draft, startDate: event.detail.value })
                      setError('')
                    }}
                  >
                    <View className={styles.date}>{draft.startDate || '开始日期'}</View>
                  </Picker>
                  <Text>至</Text>
                  <Picker
                    mode="date"
                    value={draft.endDate || datePreset('1').endDate}
                    onChange={(event) => {
                      setDraft({ ...draft, endDate: event.detail.value })
                      setError('')
                    }}
                  >
                    <View className={styles.date}>{draft.endDate || '结束日期'}</View>
                  </Picker>
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
                  const message =
                    preset === 'custom' && (!draft.startDate || !draft.endDate)
                      ? '请选择开始和结束日期'
                      : validateDateRange(draft.startDate, draft.endDate)
                  if (message) {
                    setError(message)
                    return
                  }
                  onChange(draft)
                  setPanel(null)
                }}
              >
                确定
              </Button>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
