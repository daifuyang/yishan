/**
 * 业务码验证工具库
 * 统一处理业务码验证逻辑
 */

/**
 * 业务码验证工具类
 */
export class BusinessCodeValidator {
  /**
   * 检查业务码是否表示成功
   * @param code 业务码
   * @returns 是否成功
   */
  static isSuccess(code?: number | string): boolean {
    return code != null && String(code).startsWith('200');
  }

  /**
   * 检查业务码是否表示客户端错误
   * @param code 业务码
   * @returns 是否客户端错误
   */
  static isClientError(code?: number | string): boolean {
    return code != null && String(code).startsWith('400');
  }

  /**
   * 检查业务码是否表示服务器错误
   * @param code 业务码
   * @returns 是否服务器错误
   */
  static isServerError(code?: number | string): boolean {
    return code != null && String(code).startsWith('500');
  }

  /**
   * 获取业务码对应的HTTP状态码
   * @param businessCode 业务码
   * @returns HTTP状态码
   */
  static getHttpStatus(businessCode?: number | string): number {
    if (businessCode == null) return 200;
    const code = String(businessCode);

    if (code.startsWith('200')) return 200;
    if (code.startsWith('400')) return 400;
    if (code.startsWith('401')) return 401;
    if (code.startsWith('403')) return 403;
    if (code.startsWith('404')) return 404;
    if (code.startsWith('429')) return 429;
    if (code.startsWith('500')) return 500;

    return 200; // 默认返回200
  }

  /**
   * 验证响应是否成功
   * @param response API响应对象
   * @returns 是否成功
   */
  static validateResponse(response?: { code?: number | string; success?: boolean }): boolean {
    if (!response) return false;
    
    if (response.success !== undefined) {
      return response.success;
    }

    if (response.code !== undefined) {
      return this.isSuccess(response.code);
    }

    return false;
  }
}

/**
 * 快捷验证函数
 */
export const validateBusinessCode = {
  isSuccess: BusinessCodeValidator.isSuccess,
  isClientError: BusinessCodeValidator.isClientError,
  isServerError: BusinessCodeValidator.isServerError,
  validateResponse: BusinessCodeValidator.validateResponse,
};

/**
 * 响应数据验证器
 */
export class ResponseValidator {
  /**
   * 验证响应数据是否存在
   * @param response API响应
   * @returns 是否有有效数据
   */
  static hasValidData<T>(response?: { code?: number | string; data?: T }): response is { code: number | string; data: T } {
    if (!response) return false;
    return BusinessCodeValidator.isSuccess(response.code) && response.data !== undefined;
  }

  /**
   * 安全获取响应数据
   * @param response API响应
   * @returns 数据或null
   */
  static getData<T>(response?: { code?: number | string; data?: T }): T | null {
    return this.hasValidData(response) ? response.data : null;
  }
}

export default BusinessCodeValidator;
