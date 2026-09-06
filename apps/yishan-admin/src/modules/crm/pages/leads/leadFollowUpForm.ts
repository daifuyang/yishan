import type { Dayjs } from 'dayjs';
import type { ActivityType, LeadActivityCreateInput } from '@/services/crm';

export interface LeadFollowUpFormValues {
  type: ActivityType;
  content: string;
  nextFollowUpAt?: Dayjs | null;
}

export const toLeadActivityInput = (
  values: LeadFollowUpFormValues,
): LeadActivityCreateInput => ({
  type: values.type,
  content: values.content.trim(),
  nextFollowUpAt: values.nextFollowUpAt?.toISOString() ?? null,
});
