import { Button, Picker, ScrollView, Text, View } from '@tarojs/components'
import { useState } from 'react'
import { LineIcon } from '@/components/management'
import { errorMessage } from '../_shared/AdminUI'
import { loginLogTimeRange } from './query'
import styles from './index.module.scss'

export function LogDateSheet({ startDate, endDate, onClose, onConfirm }: { startDate: string; endDate: string; onClose: () => void; onConfirm: (dates: { startDate: string; endDate: string }) => void }) {
  const [draft, setDraft] = useState({ startDate, endDate })
  const [error, setError] = useState('')
  return <View className={styles.layer}>
    <View className={styles.mask} onClick={onClose} aria-label="取消时间筛选" {...(process.env.TARO_ENV === 'h5' ? {} : { catchMove: true })} />
    <View className={styles.sheet}>
      <View className={styles.header}><Text>登录时间</Text><View className={styles.close} onClick={onClose} aria-label="关闭时间筛选"><LineIcon name="close" size={20} /></View></View>
      <ScrollView scrollY className={styles.body}>
        <Text className={styles.heading}>选择日期范围，开始或结束可单独设置</Text>
        <View className={styles.dates}>
          <Picker mode="date" value={draft.startDate} onChange={event => { setDraft({ ...draft, startDate: event.detail.value }); setError('') }}><View className={styles.date}>{draft.startDate || '开始日期不限'}</View></Picker><Text>至</Text>
          <Picker mode="date" value={draft.endDate} onChange={event => { setDraft({ ...draft, endDate: event.detail.value }); setError('') }}><View className={styles.date}>{draft.endDate || '结束日期不限'}</View></Picker>
        </View>
        {error ? <Text className={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View className={styles.footer}><Button className={styles.reset} onClick={() => { setDraft({ startDate: '', endDate: '' }); setError('') }}>重置</Button><Button className={styles.confirm} onClick={() => { try { loginLogTimeRange(draft.startDate, draft.endDate); onConfirm(draft) } catch (cause) { setError(errorMessage(cause)) } }}>确定</Button></View>
    </View>
  </View>
}
