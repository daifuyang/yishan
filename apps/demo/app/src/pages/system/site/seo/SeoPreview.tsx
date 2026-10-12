import { Text, View } from '@tarojs/components'
import { FormSection } from '@/components/management'
import { displayDomain } from '../model'
import styles from './index.module.scss'

export interface SeoPreviewProps {
  title: string
  domain: string
  description: string
}

/** 搜索结果预览：按搜索引擎结果条目的三行结构展示，未填写的部分给出弱化占位。 */
export function SeoPreview({ title, domain, description }: SeoPreviewProps) {
  const host = displayDomain(domain)
  return (
    <FormSection title="搜索预览">
      <View className={styles.preview}>
        <Text className={title ? styles.preview__title : styles.preview__muted}>{title || '未设置标题'}</Text>
        <Text className={host ? styles.preview__domain : styles.preview__muted}>{host || '未设置站点域名'}</Text>
        <Text className={description ? styles.preview__description : styles.preview__muted}>
          {description || '未设置描述'}
        </Text>
      </View>
    </FormSection>
  )
}
