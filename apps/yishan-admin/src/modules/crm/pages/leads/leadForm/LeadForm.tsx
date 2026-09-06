/**
 * LeadForm：新增 / 编辑线索的共享表单组件。
 *
 * 设计原则：
 *   - 字段只有 6~8 个，回归 ProForm 官方简洁范式：连续纵向 + 局部双列。
 *   - 双列字段用 flex 容器（flex:1 1 0; min-width:0; gap:16）：
 *     这是 antd Row/Col + percentage 算式最容易横向溢出的坑位；
 *     改用 flex-basis:0 + min-width:0 后两个子项严格等宽，
 *     永远不超过父容器（Modal 内 padding 后的可用宽度）。
 *   - 不人为增加 Section Title；语义层级由字段顺序本身表达。
 *   - 来源（sourceId）是 edit 模式唯一字段差异；其余字段两模式完全一致。
 *
 * 业务动作字段（负责人 / 状态 / 转化 / 公海）一律不进此组件，
 * 走 TransferLeadDialog、qualify/disqualify/convert 等专门入口。
 */

import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useMemo } from 'react';
import {
  LEAD_FORM_PRIMARY_FIELDS,
  type LeadFormFieldConfig,
  type LeadFormMode,
  type LeadFormValues,
  validateMobile,
} from './leadFormFields';

const MOBILE_RULE = [{ validator: validateMobile, message: '请输入正确的手机号' }]

const SUBMIT_LABELS: Record<LeadFormMode, string> = {
  create: '新增',
  edit: '保存',
}

const TITLES: Record<LeadFormMode, string> = {
  create: '新增线索',
  edit: '编辑线索',
}

export interface LeadFormProps {
  mode: LeadFormMode
  initialValues?: Partial<LeadFormValues>
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 来源选项（编辑模式使用） */
  sourceOptions?: Array<{ label: string; value: number }>
  onSubmit: (values: LeadFormValues) => Promise<void>
}

/** 必填规则：联系人姓名必填，trim 后不能为空。 */
const nameRules = [
  { required: true, message: '请输入联系人姓名' },
  {
    validator: async (_rule: unknown, value: unknown) => {
      if (typeof value === 'string' && !value.trim()) {
        throw new Error('请输入联系人姓名')
      }
    },
  },
]

const renderField = (
  cfg: LeadFormFieldConfig,
  sourceOptions: LeadFormProps['sourceOptions'],
) => {
  switch (cfg.name) {
    case 'name':
      return (
        <ProFormText
          key={cfg.name}
          name={cfg.name}
          label={cfg.label}
          placeholder={cfg.placeholder}
          rules={nameRules}
        />
      )
    case 'companyName':
    case 'wechat':
    case 'email':
    case 'phone':
    case 'qq':
      return (
        <ProFormText
          key={cfg.name}
          name={cfg.name}
          label={cfg.label}
          placeholder={cfg.placeholder}
        />
      )
    case 'mobile':
      return (
        <ProFormText
          key={cfg.name}
          name={cfg.name}
          label={cfg.label}
          placeholder={cfg.placeholder}
          rules={MOBILE_RULE}
        />
      )
    case 'sourceId':
      return (
        <ProFormSelect
          key={cfg.name}
          name={cfg.name}
          label={cfg.label}
          placeholder={cfg.placeholder}
          options={sourceOptions ?? []}
        />
      )
    case 'intention':
      return (
        <ProFormTextArea
          key={cfg.name}
          name={cfg.name}
          label={cfg.label}
          placeholder={cfg.placeholder}
          fieldProps={{
            autoSize: { minRows: 3, maxRows: 6 },
            maxLength: 2000,
            showCount: true,
          }}
        />
      )
    default:
      return null
  }
}

/**
 * 双列容器：flex + flex-basis:0 + min-width:0
 * 为什么不用 antd Row/Col：
 *   Row 的列宽公式 = (parent - gutter) / 24 * span。当父容器宽度变化时
 *   （例如浏览器缩放、Modal 响应式调整）容易出现 50% + 50% + 16px gap > 100%
 *   导致 Modal body 出现横向滚动条。
 *   flex 让两个子项各占 50% 可用空间，永远不超过父容器宽度。
 */
const TwoColumn = ({
  left,
  right,
}: {
  left: React.ReactNode
  right: React.ReactNode
}) => (
  <div
    style={{
      display: 'flex',
      gap: 16,
      width: '100%',
      minWidth: 0,
    }}
  >
    <div style={{ flex: '1 1 0', minWidth: 0 }}>{left}</div>
    <div style={{ flex: '1 1 0', minWidth: 0 }}>{right}</div>
  </div>
)

export default function LeadForm({
  mode,
  initialValues,
  open,
  onOpenChange,
  onSubmit,
  sourceOptions,
}: LeadFormProps) {
  const isEdit = mode === 'edit'

  const primaryFields = useMemo(
    () => LEAD_FORM_PRIMARY_FIELDS.filter((f) => f.modes.includes(mode)),
    [mode],
  )

  /** 按 spec §二 固定顺序渲染：
   *  name → companyName → [手机+微信] → [电话+QQ] → email → sourceId(编辑) → intention
   */
  const fieldByName = (name: LeadFormFieldConfig['name']) =>
    primaryFields.find((f) => f.name === name)

  const renderFieldByName = (name: LeadFormFieldConfig['name']) => {
    const cfg = fieldByName(name)
    return cfg ? renderField(cfg, sourceOptions) : null
  }

  return (
    <ModalForm<LeadFormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={TITLES[mode]}
      width={640}
      layout="vertical"
      initialValues={initialValues}
      // 内容多时 Body 纵向滚动；横向由 flex 容器彻底防住。
      modalProps={{
        styles: {
          body: {
            maxHeight: 'min(720px, calc(100vh - 64px))',
            overflowY: 'auto',
            // overflowX 留作最后一道防线：即便某条字段意外撑宽，
            // 也不会让 Modal body 出现横向滚动条。
            overflowX: 'hidden',
          },
        },
      }}
      submitter={{
        searchConfig: {
          submitText: SUBMIT_LABELS[mode],
          resetText: '取消',
        },
      }}
      onFinish={async (values) => {
        await onSubmit(values as LeadFormValues)
        return true
      }}
    >
      {renderFieldByName('name')}
      {renderFieldByName('companyName')}

      <TwoColumn
        left={renderFieldByName('mobile')}
        right={renderFieldByName('wechat')}
      />

      <TwoColumn
        left={renderFieldByName('phone')}
        right={renderFieldByName('qq')}
      />

      {renderFieldByName('email')}

      {/* 来源：仅编辑模式 */}
      {isEdit && renderFieldByName('sourceId')}

      {renderFieldByName('intention')}
    </ModalForm>
  )
}