/**
 * 门户文章与分类业务码
 */

// ============= 文章错误码 (324xx) =============
export const ArticleErrorCode = {
  ARTICLE_NOT_FOUND: 32401,
  ARTICLE_ALREADY_EXISTS: 32402,
  ARTICLE_STATUS_ERROR: 32403,
} as const;

export const ArticleErrorMessages = {
  [ArticleErrorCode.ARTICLE_NOT_FOUND]: "文章不存在",
  [ArticleErrorCode.ARTICLE_ALREADY_EXISTS]: "文章已存在",
  [ArticleErrorCode.ARTICLE_STATUS_ERROR]: "文章状态异常",
} as const;

// ============= 分类错误码 (3243x) =============
export const CategoryErrorCode = {
  CATEGORY_NOT_FOUND: 32431,
  CATEGORY_ALREADY_EXISTS: 32432,
  CATEGORY_DELETE_FORBIDDEN: 32433,
} as const;

export const CategoryErrorMessages = {
  [CategoryErrorCode.CATEGORY_NOT_FOUND]: "分类不存在",
  [CategoryErrorCode.CATEGORY_ALREADY_EXISTS]: "分类已存在",
  [CategoryErrorCode.CATEGORY_DELETE_FORBIDDEN]: "分类删除被禁止",
} as const;

export type ArticleErrorCodeType = typeof ArticleErrorCode[keyof typeof ArticleErrorCode];
export type ArticleErrorMessageType = typeof ArticleErrorMessages[keyof typeof ArticleErrorMessages];
export type CategoryErrorCodeType = typeof CategoryErrorCode[keyof typeof CategoryErrorCode];
export type CategoryErrorMessageType = typeof CategoryErrorMessages[keyof typeof CategoryErrorMessages];

