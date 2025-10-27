/**
 * 业务码兼容性导出
 * 为了保持向后兼容，重新导出新的模块化业务码
 * @deprecated 建议使用 './business-codes/index.js' 中的模块化导入
 */

// 重新导出所有业务码相关内容
export * from './business-codes/index.js';

// 为了兼容性，保持原有的导出方式
import { SUCCESS_CODE, ErrorCode, BusinessCode } from './business-codes/index.js';

export { SUCCESS_CODE, ErrorCode, BusinessCode };