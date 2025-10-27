/**
 * 业务异常类
 * 用于抛出带有业务码的异常
 */
export class BusinessError extends Error {
  public readonly code: number;
  public readonly details?: string;

  constructor(code: number, message?: string, details?: string) {
    super(message || `${code}`);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
  }

  /**
   * 创建业务异常的静态方法
   * @param code 业务码
   * @param message 自定义错误消息（可选）
   * @param details 错误详情（可选）
   * @returns BusinessError实例
   */
  static create(code: number, message?: string, details?: string): BusinessError {
    return new BusinessError(code, message, details);
  }
}