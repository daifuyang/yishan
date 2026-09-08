/**
 * LeadForm 共享组件入口。
 *
 * CreateLeadDialog / EditLeadDialog 各自 wrap 一份 LeadForm，
 * 字段范围由 mode 决定。
 */

export { default as LeadForm } from './LeadForm';
export type { LeadFormProps } from './LeadForm';
export type {
  LeadFormMode,
  LeadFormValues,
  LeadFormFieldConfig,
  LeadFormFieldName,
} from './leadFormFields';
export {
  LEAD_FORM_PRIMARY_FIELDS,
  validateMobile,
  validateRequiredName,
} from './leadFormFields';