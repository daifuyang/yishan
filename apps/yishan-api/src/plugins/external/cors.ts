import cors from '@fastify/cors'

export const autoConfig = {
  origin: (origin: string, cb: Function) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yishan.example.com'
    ]
    
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