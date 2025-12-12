/**
 * 业务码统一导出和管理
 * 提供统一的业务码访问接口和工具方法
 */

// 导出所有业务码模块
export * from './common.js';
export * from './validation.js';
export * from './auth.js';
export * from './user.js';
export * from './resource.js';
export * from './business.js';
export * from './system.js';
export * from './role.js';
export * from './dept.js';
export * from './post.js';
export * from './menu.js';
export * from './dict.js';
export * from './article.js';
export * from './page.js';
export * from './template.js';

// 重新导出常用的业务码
import { SUCCESS_CODE, SystemErrorCode } from './common.js';
import { ValidationErrorCode } from './validation.js';
import { AuthErrorCode } from './auth.js';
import { UserErrorCode } from './user.js';
import { ResourceErrorCode } from './resource.js';
import { BusinessErrorCode } from './business.js';
import { SystemManageErrorCode } from './system.js';
import { RoleErrorCode } from './role.js';
import { DeptErrorCode } from './dept.js';
import { PostErrorCode } from './post.js';
import { MenuErrorCode } from './menu.js';
import { DictErrorCode } from './dict.js';
import { ArticleErrorCode, CategoryErrorCode } from './article.js';
import { PageErrorCode } from './page.js';
import { TemplateErrorCode } from './template.js';

// 合并所有错误码
export const ErrorCode = {
  ...SystemErrorCode,
  ...ValidationErrorCode,
  ...AuthErrorCode,
  ...UserErrorCode,
  ...ResourceErrorCode,
  ...BusinessErrorCode,
  ...SystemManageErrorCode,
  ...RoleErrorCode,
  ...DeptErrorCode,
  ...PostErrorCode,
  ...MenuErrorCode,
  ...DictErrorCode,
  ...ArticleErrorCode,
  ...CategoryErrorCode,
  ...PageErrorCode,
  ...TemplateErrorCode,
  // 添加一些常用的别名
  NOT_FOUND: ResourceErrorCode.RESOURCE_NOT_FOUND,
} as const;

// 导入所有错误消息
import { 
  SystemErrorMessages,
  SystemHttpStatusMap 
} from './common.js';
import { 
  ValidationErrorMessages,
  ValidationHttpStatusMap 
} from './validation.js';
import { 
  AuthErrorMessages,
  AuthHttpStatusMap 
} from './auth.js';
import { 
  UserErrorMessages
} from './user.js';
import { 
  ResourceErrorMessages,
  ResourceHttpStatusMap 
} from './resource.js';
import { 
  BusinessErrorMessages
} from './business.js';
import { 
  SystemManageErrorMessages,
  SystemManageHttpStatusMap
} from './system.js';
import { 
  RoleErrorMessages
} from './role.js';
import { 
  DeptErrorMessages
} from './dept.js';
import { 
  PostErrorMessages
} from './post.js';
import { 
  MenuErrorMessages
} from './menu.js';
import { 
  DictErrorMessages
} from './dict.js';
import { ArticleErrorMessages, CategoryErrorMessages } from './article.js';
import { PageErrorMessages } from './page.js';
import { TemplateErrorMessages } from './template.js';

// 合并所有错误消息
const ErrorMessages = {
  ...SystemErrorMessages,
  ...ValidationErrorMessages,
  ...AuthErrorMessages,
  ...UserErrorMessages,
  ...ResourceErrorMessages,
  ...BusinessErrorMessages,
  ...SystemManageErrorMessages,
  ...RoleErrorMessages,
  ...DeptErrorMessages,
  ...PostErrorMessages,
  ...MenuErrorMessages,
  ...DictErrorMessages,
  ...ArticleErrorMessages,
  ...CategoryErrorMessages,
  ...PageErrorMessages,
  ...TemplateErrorMessages,
} as const;

// 合并所有HTTP状态码映射
const HttpStatusMap = {
  ...SystemHttpStatusMap,
  ...ValidationHttpStatusMap,
  ...AuthHttpStatusMap,
  ...ResourceHttpStatusMap,
  ...SystemManageHttpStatusMap,
} as const;

/**
 * 业务码工具类
 * 提供业务码相关的工具方法
 */
export class BusinessCode {
  /**
   * 获取错误信息
   * @param code 业务码
   * @returns 错误信息
   */
  static getMessage(code: number): string {
    return ErrorMessages[code as keyof typeof ErrorMessages] || "未知错误";
  }

  /**
   * 获取HTTP状态码
   * @param code 业务码
   * @returns HTTP状态码
   */
  static getHttpStatus(code: number): number {
    // 优先从映射表中查找
    const mappedStatus = HttpStatusMap[code as keyof typeof HttpStatusMap];
    if (mappedStatus !== undefined) {
      return mappedStatus;
    }
    
    // 根据业务码范围确定默认状态码
    if (code === SUCCESS_CODE) return 200;
    
    // 系统错误 (20xxx) - 服务器内部错误
    if (code >= 20000 && code < 21000) return 500;
    
    // 参数验证错误 (21xxx) - 客户端请求错误
    if (code >= 21000 && code < 22000) return 400;
    
    // 认证授权错误 (22xxx) - 未授权错误
    if (code >= 22000 && code < 23000) return 401;
    
    // 用户相关错误 (30xxx) - 业务错误，返回200
    if (code >= 30000 && code < 31000) return 200;
    
    // 资源相关错误 (31xxx) - 资源未找到等，返回200（业务层面的资源错误）
    if (code >= 31000 && code < 32000) return 200;
    
    // 业务逻辑错误 (32xxx) - 业务错误，返回200
    if (code >= 32000 && code < 33000) return 200;
    
    // 未知错误码，默认返回500
    return 500;
  }

  /**
   * 判断是否为成功码
   * @param code 业务码
   * @returns 是否为成功码
   */
  static isSuccess(code: number): boolean {
    return code === SUCCESS_CODE;
  }

  /**
   * 判断是否为错误码
   * @param code 业务码
   * @returns 是否为错误码
   */
  static isError(code: number): boolean {
    return code !== SUCCESS_CODE;
  }

  /**
   * 获取错误码对应的错误类型
   * @param code 业务码
   * @returns 错误类型描述
   */
  static getErrorType(code: number): string {
    if (code >= 20000 && code < 21000) return "系统错误";
    if (code >= 21000 && code < 22000) return "参数错误";
    if (code >= 22000 && code < 23000) return "权限错误";
    if (code >= 30000 && code < 31000) return "用户错误";
    if (code >= 31000 && code < 32000) return "资源错误";
    if (code >= 32000 && code < 33000) return "业务错误";
    return "未知错误";
  }

  /**
   * 获取错误码的模块名称
   * @param code 业务码
   * @returns 模块名称
   */
  static getModuleName(code: number): string {
    if (code >= 20000 && code < 21000) return "system";
    if (code >= 21000 && code < 22000) return "validation";
    if (code >= 22000 && code < 23000) return "auth";
    if (code >= 30000 && code < 31000) return "user";
    if (code >= 31000 && code < 32000) return "resource";
    if (code >= 32000 && code < 33000) return "business";
    return "unknown";
  }

  /**
   * 验证业务码是否有效
   * @param code 业务码
   * @returns 是否有效
   */
  static isValidCode(code: number): boolean {
    return code === SUCCESS_CODE || ErrorMessages.hasOwnProperty(code);
  }
}

// 导出成功码
export { SUCCESS_CODE };
