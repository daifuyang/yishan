/**
 * 应用配置中心
 * 统一管理所有环境变量和配置项
 */

// JWT 配置
export const JWT_CONFIG = {
  // JWT 密钥
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  
  // 默认过期时间（用于兼容现有代码）
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // 访问令牌配置
  accessToken: {
    // 默认过期时间（秒）
    defaultExpiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '86400'), // 24小时
    
    // 记住我功能下的过期时间（秒）
    rememberMeExpiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_REMEMBER_ME_EXPIRES_IN || '2592000'), // 30天
  },
  
  // 刷新令牌配置
  refreshToken: {
    // 默认过期时间（秒）
    defaultExpiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '604800'), // 7天
    
    // 记住我功能下的过期时间（秒）
    rememberMeExpiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN || '7776000'), // 90天
  }
};

// 数据库配置
export const DATABASE_CONFIG = {
  url: process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/yishan',
};

// Redis 配置
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
};

// 应用配置
export const APP_CONFIG = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
};

// 安全配置
export const SECURITY_CONFIG = {
  // 密码加密相关配置
  password: {
    // scrypt 算法参数
    scrypt: {
      keylen: 32,
      cost: 16384, // 2^14
      blockSize: 8,
      parallelization: 1,
    }
  },
  
  // 登录安全相关配置
  login: {
    // 最大登录失败次数（用于账号锁定）
    maxFailedAttempts: parseInt(process.env.MAX_LOGIN_FAILED_ATTEMPTS || '5'),
    
    // 账号锁定时间（秒）
    lockoutDuration: parseInt(process.env.LOGIN_LOCKOUT_DURATION || '3600'), // 1小时
  }
};

// 缓存配置（统一TTL管理）
export const CACHE_CONFIG = {
  // 全局默认TTL（秒） 一天
  defaultTTLSeconds: parseInt(process.env.CACHE_TTL_DEFAULT || '86400'),
};

// 存储与上传配置
export const STORAGE_CONFIG = {
  uploadDir: process.env.UPLOAD_DIR || 'public/uploads',
};

/**
 * Admin 前端在 API 同站部署时的 URL 前缀。
 *
 * 默认 `/admin`，对应 admin 编译时的 PUBLIC_PATH=admin/、CDN/函数静态资源挂载在 /admin/*。
 * 必须以 `/` 开头、不带尾斜杠（fastifyStatic 的 prefix 约定）。其他部署形态（如把 admin
 * 单独挂在子域名）可设为 `/`。
 *
 * 与 admin 的 `__APP_BASE__`、`PUBLIC_PATH` 必须保持一致，否则静态资源 404 + SPA 路由错位。
 */
export const ADMIN_BASE_PATH = (() => {
  const raw = (process.env.ADMIN_BASE_PATH || '/admin').trim()
  const trimmed = raw.replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}` : '/'
})()

/**
 * Admin 部署配置：是否在生产环境把根路径 `/` 重定向到 admin 前缀。
 *
 * 默认开启。把 admin 编译成 `/admin/` 前缀的部署形态（fc / Nginx 子路径等）通常需要
 * 让访问者输入根域名也能落到 admin SPA；本地调试 API 时不希望被吞掉首页请求。
 */
export const ADMIN_CONFIG = {
  redirectRoot: (process.env.ADMIN_REDIRECT_ROOT ?? 'true').toLowerCase() !== 'false',
}

// 七牛云配置
export const QINIU_CONFIG = {
  accessKey: process.env.QINIU_AK || '',
  secretKey: process.env.QINIU_SK || '',
  bucket: process.env.QINIU_BUCKET || '',
  /** 过期时间（秒），默认1小时 */
  expiresIn: parseInt(process.env.QINIU_EXPIRES || '3600'),
  /** 可选：直传上传域名，如 https://upload.qiniup.com */
  uploadUrl: process.env.QINIU_UPLOAD_URL || '',
};
