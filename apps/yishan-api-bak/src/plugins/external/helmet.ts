import helmet from '@fastify/helmet'

export const autoConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}

/**
 * This plugin adds security headers to the application
 *
 * @see {@link https://github.com/fastify/fastify-helmet}
 */
export default helmet