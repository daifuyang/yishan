/**
 * 菜单模块业务码
 * 包含系统菜单管理相关的业务错误码
 */

// ============= 菜单业务错误码 (32xxx) =============
export const MenuErrorCode = {
  /** 菜单不存在 */
  MENU_NOT_FOUND: 32401,
  /** 菜单已存在（名称或路径冲突） */
  MENU_ALREADY_EXISTS: 32402,
  /** 菜单删除被禁止（如存在子菜单或已绑定角色） */
  MENU_DELETE_FORBIDDEN: 32403,
  /** 菜单父级不合法（循环引用或父级不存在） */
  MENU_INVALID_PARENT: 32404,
} as const;

// ============= 错误消息映射 =============
export const MenuErrorMessages = {
  [MenuErrorCode.MENU_NOT_FOUND]: '菜单不存在',
  [MenuErrorCode.MENU_ALREADY_EXISTS]: '菜单已存在（名称或路径冲突）',
  [MenuErrorCode.MENU_DELETE_FORBIDDEN]: '存在子菜单或已绑定角色，禁止删除',
  [MenuErrorCode.MENU_INVALID_PARENT]: '菜单父级不合法',
} as const;

// ============= 类型定义 =============
export type MenuErrorCodeType = typeof MenuErrorCode[keyof typeof MenuErrorCode];
export type MenuErrorMessageType = typeof MenuErrorMessages[keyof typeof MenuErrorMessages];