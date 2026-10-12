import { Text, View } from '@tarojs/components'
import type { StorageConnectionResult } from '@/api/admin/storage'
import { DetailRow, FormSection } from '@/components/management'
import styles from './ConnectionTest.module.scss'

export interface ConnectionTestProps {
  testing: boolean
  result: StorageConnectionResult | null
  disabled?: boolean
  onTest: () => void
}

/**
 * 连接测试：用当前表单草稿（无需先保存）请求服务商空间信息。
 * 结果就地展示在按钮下方，用户不必在弹窗与表单之间来回对照。
 */
export function ConnectionTest({ testing, result, disabled = false, onTest }: ConnectionTestProps) {
  const inactive = disabled || testing
  return (
    <FormSection title="连接测试" hint={result ? undefined : '使用当前填写的配置测试，无需先保存'}>
      <View
        className={inactive ? `${styles.action} ${styles['action--disabled']}` : styles.action}
        hoverClass={inactive ? undefined : styles['action--hover']}
        aria-label="测试连接"
        aria-disabled={inactive}
        onClick={inactive ? undefined : onTest}
      >
        <Text>{testing ? '测试中…' : '测试连接'}</Text>
      </View>
      {result ? (
        <>
          <DetailRow
            label="结果"
            value={
              <Text className={result.ok ? styles.ok : styles.fail}>{result.ok ? '连接成功' : '连接失败'}</Text>
            }
          />
          <DetailRow label="空间" value={result.bucket} />
          <DetailRow label="耗时" value={`${result.latencyMs}ms`} />
          {result.ok ? null : <DetailRow label="原因" value={result.message || '请检查配置'} multiline />}
        </>
      ) : null}
    </FormSection>
  )
}
