import { scopedConfig } from './scope'
export const JWT_CONFIG = scopedConfig('JWT_CONFIG')
export const REDIS_CONFIG = scopedConfig('REDIS_CONFIG')
export const APP_CONFIG = scopedConfig('APP_CONFIG')
export const SECURITY_CONFIG = scopedConfig('SECURITY_CONFIG')
export const CACHE_CONFIG = scopedConfig('CACHE_CONFIG')
export const QINIU_CONFIG = scopedConfig('QINIU_CONFIG')
export const STORAGE = scopedConfig('STORAGE')
export const ADMIN = scopedConfig('ADMIN')
export { createSystemConfig, type SystemConfig } from './create'
