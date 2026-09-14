import dayjs, { type Dayjs } from 'dayjs';
import type { ActivityType, LeadActivityCreateInput, LeadStatus } from '@/services/crm';

/**
 * 写跟进表单的字段值。
 *
 * nextFollowUpAt 在 antd 表单里通常是 Dayjs 实例，但 ModalForm + destroyOnHidden
 * 重建场景下偶尔会得到字符串/原始 Date，因此收口时统一交给 dayjs() 归一化。
 */
export interface LeadFollowUpFormValues {
  type: ActivityType;
  content: string;
  followUpStatus: LeadStatus;
  nextFollowUpAt?: Dayjs | string | Date | null;
}

/**
 * 表单值 → 接口入参。
 *
 * 规则：
 *   - 跟进方式与跟进内容必填，content 做 trim。
 *   - nextFollowUpAt 接受 Dayjs / Date / ISO 字符串，falsy 一律 null。
 *     转换层用 dayjs() 收口，不再假设上层一定给 Dayjs 实例。
 */
export const toLeadActivityInput = (
  values: LeadFollowUpFormValues,
): LeadActivityCreateInput => {
  const next = values.nextFollowUpAt;
  return {
    type: values.type,
    content: values.content.trim(),
    followUpStatus: values.followUpStatus,
    nextFollowUpAt: next ? dayjs(next).toISOString() : null,
  };
};
