/**
 * CRM 模块业务码（独立命名空间，避免污染 core）。
 *
 * 编号段 33xxx（与 dept 322xx / role 321xx / dict 留出间距）。
 *
 * 与 core 的 ErrorCode / BusinessCode 不同：CRM 不进 core 合并表，
 * 而是在 service 内通过 BusinessError(code, message) 抛出；
 * message 由调用方显式提供，所以这里只声明 code 常量本身。
 */

export const CrmErrorCode = {
  /* ─── Customer (330xx) ─────────────── */
  CRM_CUSTOMER_NOT_FOUND: 33001,
  CRM_CUSTOMER_DUPLICATE: 33002,
  CRM_CUSTOMER_ALREADY_OWNED: 33003,
  CRM_CUSTOMER_NOT_IN_POOL: 33004,
  CRM_CUSTOMER_TRANSFER_FORBIDDEN: 33005,
  CRM_CUSTOMER_RELEASE_FORBIDDEN: 33006,
  CRM_CUSTOMER_TYPE_INVALID: 33007,
  CRM_CUSTOMER_OWNER_REQUIRED: 33008,
  CRM_CUSTOMER_TRANSFER_TARGET_INVALID: 33009,

  /* ─── Contact (331xx) ─────────────── */
  CRM_CONTACT_NOT_FOUND: 33101,
  CRM_CONTACT_CUSTOMER_MISMATCH: 33102,

  /* ─── Activity (332xx) ────────────── */
  CRM_ACTIVITY_NOT_FOUND: 33201,
  CRM_ACTIVITY_CONTENT_REQUIRED: 33202,
  CRM_ACTIVITY_TYPE_INVALID: 33203,

  /* ─── Settings / Tag / Status / Source (333xx) */
  CRM_TAG_NOT_FOUND: 33301,
  CRM_TAG_NAME_DUPLICATE: 33302,
  CRM_STATUS_NOT_FOUND: 33311,
  CRM_STATUS_NAME_DUPLICATE: 33312,
  CRM_STATUS_SYSTEM_PROTECTED: 33313,
  CRM_SOURCE_NOT_FOUND: 33321,
  CRM_SOURCE_NAME_DUPLICATE: 33322,
} as const

export type CrmErrorCodeType = (typeof CrmErrorCode)[keyof typeof CrmErrorCode]
