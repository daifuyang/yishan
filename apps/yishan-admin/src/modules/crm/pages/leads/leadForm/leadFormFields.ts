/**
 * LeadForm 字段配置。
 *
 * 字段由 mode 决定可见范围：
 *   - create 强调快速录入，暴露常用资料字段。
 *   - edit   允许维护稍完整的资料，多了「来源」。
 *
 * 业务动作字段（负责人 / 状态 / 转化 / 公海）不进 LeadForm，
 * 走专门的 Dialog：TransferLeadDialog、qualify/disqualify/convert 等。
 */

export type LeadFormMode = 'create' | 'edit'

export interface LeadFormValues {
  /** 联系人姓名 */
  name?: string
  /** 公司名称 */
  companyName?: string
  /** 手机号 */
  mobile?: string
  /** 微信 */
  wechat?: string
  /** 电话 */
  phone?: string
  /** QQ */
  qq?: string
  /** 邮箱 */
  email?: string
  /** 意向说明 */
  intention?: string
  /** 线索来源 ID（编辑模式使用） */
  sourceId?: number | null
}

export type LeadFormFieldName = keyof LeadFormValues

export interface LeadFormFieldConfig {
  name: LeadFormFieldName
  label: string
  modes: ReadonlyArray<LeadFormMode>
  required?: boolean
  placeholder: string
}

/**
 * 全部字段扁平化；LeadForm 按固定顺序 + ProForm.Group 拼装渲染。
 * 顺序：联系人 → 公司 → 手机+微信 → 电话+QQ → 邮箱 → 来源(编辑) → 意向说明
 */
export const LEAD_FORM_PRIMARY_FIELDS: ReadonlyArray<LeadFormFieldConfig> = [
  { name: 'name', label: '联系人', modes: ['create', 'edit'], required: true, placeholder: '请输入联系人姓名' },
  { name: 'companyName', label: '公司', modes: ['create', 'edit'], placeholder: '请输入公司名称' },
  { name: 'mobile', label: '手机', modes: ['create', 'edit'], placeholder: '请输入手机号' },
  { name: 'wechat', label: '微信', modes: ['create', 'edit'], placeholder: '请输入微信' },
  { name: 'phone', label: '电话', modes: ['create', 'edit'], placeholder: '请输入电话' },
  { name: 'qq', label: 'QQ', modes: ['create', 'edit'], placeholder: '请输入QQ' },
  { name: 'email', label: '邮箱', modes: ['create', 'edit'], placeholder: '请输入邮箱' },
  { name: 'sourceId', label: '来源', modes: ['edit'], placeholder: '请选择来源' },
  { name: 'intention', label: '意向说明', modes: ['create', 'edit'], placeholder: '请输入客户需求或咨询内容' },
]

/** 字段级校验：联系人姓名 trim 后必填 */
export const validateRequiredName = async (_rule: unknown, value: unknown): Promise<void> => {
  if (typeof value === 'string' && !value.trim()) {
    throw new Error('请输入联系人姓名')
  }
}

/** 字段级校验：手机格式（可选，填写后才校验） */
export const validateMobile = async (_rule: unknown, value: unknown): Promise<void> => {
  if (value === undefined || value === null || value === '') return
  if (!/^1\d{10}$/.test(String(value))) {
    throw new Error('请输入正确的手机号')
  }
}