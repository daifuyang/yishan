import { Input, Text, View } from '@tarojs/components'
import { useState } from 'react'
import { FormField, LineIcon } from '@/components/management'
import { joinKeywords, parseKeywords } from '../model'
import styles from './index.module.scss'

export interface KeywordsFieldProps {
  /** PC 同一字段：英文逗号分隔的字符串 */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/** 关键词标签输入：逐个添加、点 × 删除；提交仍是逗号分隔字符串，与 PC 端一致。 */
export function KeywordsField({ value, onChange, disabled = false }: KeywordsFieldProps) {
  const [draft, setDraft] = useState('')
  const keywords = parseKeywords(value)
  const commit = (text: string) => {
    setDraft('')
    if (parseKeywords(text).length) onChange(joinKeywords(parseKeywords(`${value},${text}`)))
  }
  return (
    <FormField label="关键词" stacked disabled={disabled}>
      <View className={styles.keywords}>
        {keywords.map((keyword) => (
          <View key={keyword} className={styles.keyword}>
            <Text>{keyword}</Text>
            {disabled ? null : (
              <View
                className={styles.keyword__remove}
                aria-label={`删除 ${keyword}`}
                onClick={() => onChange(joinKeywords(keywords.filter((item) => item !== keyword)))}
              >
                <LineIcon name="close" size={12} color="#86909C" />
              </View>
            )}
          </View>
        ))}
        {disabled ? null : (
          <Input
            className={styles.keywords__input}
            value={draft}
            placeholder={keywords.length ? '继续添加' : '输入关键词后回车，多个可用逗号分隔'}
            confirmType="done"
            maxlength={50}
            onInput={(event) => {
              const text = event.detail.value
              // 输入逗号即成词，粘贴「a,b,c」也能一次拆开
              if (/[,，]/.test(text)) commit(text)
              else setDraft(text)
            }}
            onConfirm={() => commit(draft)}
            onBlur={() => commit(draft)}
          />
        )}
      </View>
    </FormField>
  )
}
