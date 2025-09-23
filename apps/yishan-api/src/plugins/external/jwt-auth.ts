import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'

export const autoConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  messages: {
    badRequestErrorMessage: 'Format is Authorization: Bearer [token]',
    noAuthorizationInHeaderMessage: 'Autorization header is missing!',
    authorizationTokenExpiredMessage: 'Authorization token expired',
    authorizationTokenInvalid: (err: Error) => `Authorization token is invalid: ${err.message}`,
    authorizationTokenUnsigned: 'Authorization token unsigned'
  }
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, autoConfig)

  // 添加JWT验证装饰器
  fastify.decorate('authenticate', async function(request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({
        success: false,
        message: '无效的token或token已过期',
        code: 40001,
        data: null
      })
    }
  })
}, {
  name: 'jwt-auth'
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: number
      email: string
      username: string
    }
    user: {
      id: number
      email: string
      username: string
      iat: number
      exp: number
    }
  }
}