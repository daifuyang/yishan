import type { ReactNode } from 'react'
import { Button, Picker, Text, View } from '@tarojs/components'
import { FormField } from '@/components/molecules'
import { PageContainer } from '@/components/layout'
import { navigateBack } from '@/utils/router'
import './admin.scss'

export function AdminPage({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <PageContainer><View className="admin-page">
    <View className="admin-header"><Button className="admin-back" aria-label="返回" onClick={() => navigateBack(1)}>‹</Button><Text className="admin-title">{title}</Text><View className="admin-header-action">{action}</View></View>
    <View className="admin-content">{children}</View>
  </View></PageContainer>
}

export function AdminSelect({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: readonly { label: string; value: string }[]; onChange: (value: string) => void; disabled?: boolean
}) {
  const index = options.findIndex((option) => option.value === value)
  return <Picker disabled={disabled} range={options.map((option) => option.label)} value={Math.max(index, 0)} onChange={(event) => {
    const option = options[Number(event.detail.value)]
    if (option) onChange(option.value)
  }}><FormField type="picker" label={label} value={options[index]?.label} disabled={disabled} /></Picker>
}

export function AdminNotice({ children }: { children: ReactNode }) {
  return <View className="admin-notice"><Text>{children}</Text></View>
}
