export class BusinessError extends Error {
  public readonly code: number;
  public readonly details?: string;

  constructor(code: number, message?: string, details?: string) {
    super(message || `${code}`);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
  }

  static create(code: number, message?: string, details?: string): BusinessError {
    return new BusinessError(code, message, details);
  }
}
