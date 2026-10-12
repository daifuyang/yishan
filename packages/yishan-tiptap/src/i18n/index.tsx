import * as React from 'react'

export type TiptapLocale = {
  editorAriaLabel: string
  toolbar: string
  heading: string
  formatHeading: string
  list: string
  listOptions: string
  blockquote: string
  codeBlock: string
  link: string
  addImage: string
  highlight: string
  toggleFullscreen: string
  pasteLink: string
  applyLink: string
  openLink: string
  removeLink: string
  alignLeft: string
  alignCenter: string
  alignRight: string
  alignJustify: string
  clickToUpload: string
  dragAndDrop: string
  maximumFiles: (limit: number, maxSizeMb: number) => string
  uploadingFiles: (count: number) => string
  clearAll: string
}

export const zhCN: TiptapLocale = {
  editorAriaLabel: '编辑器内容区，开始输入内容',
  toolbar: '编辑器工具栏',
  heading: '标题',
  formatHeading: '设置标题格式',
  list: '列表',
  listOptions: '列表选项',
  blockquote: '引用',
  codeBlock: '代码块',
  link: '链接',
  addImage: '添加图片',
  highlight: '高亮',
  toggleFullscreen: '切换全屏',
  pasteLink: '粘贴链接…',
  applyLink: '应用链接',
  openLink: '在新窗口打开链接',
  removeLink: '移除链接',
  alignLeft: '左对齐',
  alignCenter: '居中对齐',
  alignRight: '右对齐',
  alignJustify: '两端对齐',
  clickToUpload: '点击上传',
  dragAndDrop: '或拖拽图片至此处',
  maximumFiles: (limit, maxSizeMb) => `最多 ${limit} 个文件，单个不超过 ${maxSizeMb}MB`,
  uploadingFiles: (count) => `正在上传 ${count} 个文件`,
  clearAll: '清空全部',
}

const TiptapLocaleContext = React.createContext<TiptapLocale>(zhCN)

export const TiptapLocaleProvider: React.FC<{
  locale?: Partial<TiptapLocale>
  children: React.ReactNode
}> = ({ locale, children }) => {
  const value = React.useMemo(() => ({ ...zhCN, ...locale }), [locale])
  return <TiptapLocaleContext.Provider value={value}>{children}</TiptapLocaleContext.Provider>
}

export const useTiptapLocale = () => React.useContext(TiptapLocaleContext)
