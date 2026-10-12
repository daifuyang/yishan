import { ScrollView, Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'
import type { AttachmentFolder } from '@/api/admin/attachments'
import { LineIcon } from '@/components/management'
import { folderPath } from './model'
import styles from './FolderTreeSheet.module.scss'

export interface FolderTreeSheetProps {
  open: boolean
  title: string
  folders: AttachmentFolder[]
  /** 当前选中；0 表示根选项（全部分组 / 未分组） */
  value: number
  /** 根选项文案，如「全部分组」「未分组」「顶级分组」 */
  rootLabel: string
  /** 不可选也不可进入的分组（上级分组防环） */
  excludeIds?: ReadonlySet<number>
  /** 面板底部固定入口，如「管理分组」 */
  footer?: { label: string; onClick: () => void }
  onSelect: (id: number) => void
  onClose: () => void
}

const nameOf = (folder: AttachmentFolder) =>
  folder.status === '0' ? `${folder.name}（已禁用）` : folder.name

/** 单选分组：逐层下钻，点名称即选中；与部门多选导航不同，不带勾选框。 */
export function FolderTreeSheet({
  open,
  title,
  folders,
  value,
  rootLabel,
  excludeIds,
  footer,
  onSelect,
  onClose,
}: FolderTreeSheetProps) {
  const [path, setPath] = useState<AttachmentFolder[]>([])
  useEffect(() => {
    // 打开时停在当前值的父层，选中项就在眼前
    if (open) setPath(folderPath(folders, value).slice(0, -1))
  }, [open, value, folders])
  if (!open) return null
  const current = path[path.length - 1]
  const visible = (current ? current.children || [] : folders).filter(
    (folder) => !excludeIds?.has(folder.id),
  )
  const choose = (id: number) => {
    onSelect(id)
    onClose()
  }
  const selfLabel = current ? `全部（${current.name}）` : rootLabel
  const selfValue = current ? current.id : 0
  return (
    <View className={styles.layer}>
      <View className={styles.mask} onClick={onClose} aria-label="取消选择" />
      <View className={styles.sheet}>
        <View className={styles.header}>
          <Text>{title}</Text>
          <View className={styles.close} onClick={onClose} aria-label="关闭选择">
            <LineIcon name="close" size={20} />
          </View>
        </View>
        <View className={styles.crumbs}>
          <Text className={styles.crumb} aria-label="面包屑-全部" onClick={() => setPath([])}>
            全部
          </Text>
          {path.map((folder, index) => (
            <Text
              key={folder.id}
              className={styles.crumb}
              aria-label={`面包屑-${folder.name}`}
              onClick={() => setPath(path.slice(0, index + 1))}
            >
              {` / ${folder.name}`}
            </Text>
          ))}
        </View>
        <ScrollView scrollY className={styles.options}>
          <View
            className={`${styles.option} ${value === selfValue ? styles.selected : ''}`}
            aria-label={selfLabel}
            onClick={() => choose(selfValue)}
          >
            <Text>{selfLabel}</Text>
            {value === selfValue ? <LineIcon name="check" size={18} color="#1677FF" /> : null}
          </View>
          {visible.map((folder) => {
            const children = (folder.children || []).filter((child) => !excludeIds?.has(child.id))
            return (
              <View key={folder.id} className={styles.option}>
                <View
                  className={`${styles.optionName} ${value === folder.id ? styles.selected : ''}`}
                  aria-label={nameOf(folder)}
                  onClick={() => choose(folder.id)}
                >
                  <Text>{nameOf(folder)}</Text>
                  {value === folder.id ? <LineIcon name="check" size={18} color="#1677FF" /> : null}
                </View>
                {children.length ? (
                  <View
                    className={styles.enter}
                    aria-label={`进入-${folder.name}`}
                    onClick={() => setPath([...path, folder])}
                  >
                    <Text>下级</Text>
                    <LineIcon name="chevronRight" size={14} color="#86909C" />
                  </View>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
        {footer ? (
          <View
            className={styles.footer}
            aria-label={footer.label}
            onClick={() => {
              onClose()
              footer.onClick()
            }}
          >
            <Text>{footer.label}</Text>
            <LineIcon name="chevronRight" size={16} color="#1677FF" />
          </View>
        ) : null}
      </View>
    </View>
  )
}
