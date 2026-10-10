import type { ApiTokenDurationValue } from './types';

export const DATE_FMT = 'YYYY-MM-DD HH:mm';

export const DURATION_OPTIONS: { value: ApiTokenDurationValue; i18nKey: string }[] = [
  { value: '7d', i18nKey: 'account.apiTokens.createModal.duration.7d' },
  { value: '30d', i18nKey: 'account.apiTokens.createModal.duration.30d' },
  { value: '60d', i18nKey: 'account.apiTokens.createModal.duration.60d' },
  { value: '90d', i18nKey: 'account.apiTokens.createModal.duration.90d' },
  { value: '1y', i18nKey: 'account.apiTokens.createModal.duration.1y' },
  { value: 'never', i18nKey: 'account.apiTokens.createModal.duration.never' },
];

export const GENDER_OPTIONS: { value: '0' | '1' | '2'; label: string }[] = [
  { value: '0', label: '未知' },
  { value: '1', label: '男' },
  { value: '2', label: '女' },
];

export const PHONE_PATTERN = /^1[3-9]\d{9}$/;

// 与后端 schema 保持一致：必须含字母和数字，长度 ≥ 6
export const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/;
