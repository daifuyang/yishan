import cors from '@fastify/cors'

export const autoConfig = {
  origin: (origin: string, cb: Function) => {
    // 从环境变量获取允许的域名
    const host = process.env.HOST || 'localhost'
    const port = process.env.PORT || '3000'
    
    const allowedOrigins: string[] = [
      `http://${host}:${port}`,
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
    ]
    
    // 如果设置了额外的允许域名环境变量
    if (process.env.ALLOWED_ORIGINS) {
      const extraOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      allowedOrigins.push(...extraOrigins)
    }
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return cb(null, true)
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true
}

/**
 * This plugin enables CORS for the application
 *
 * @see {@link https://github.com/fastify/fastify-cors}
 */
export default cors