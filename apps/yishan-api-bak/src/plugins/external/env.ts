import fp from 'fastify-plugin'
import env from '@fastify/env'

declare module 'fastify' {
  export interface FastifyInstance {
    config: {
      PORT: number;
      NODE_ENV: string;
      MYSQL_HOST: string;
      MYSQL_PORT: number;
      MYSQL_USER: string;
      MYSQL_PASSWORD: string;
      MYSQL_DATABASE: string;
      CAN_CREATE_DATABASE: number;
      CAN_DROP_DATABASE: number;
      CAN_SEED_DATABASE: number;
      FASTIFY_CLOSE_GRACE_DELAY: number;
      LOG_LEVEL: string;
      COOKIE_SECRET: string;
      COOKIE_NAME: string;
      COOKIE_SECURED: boolean;
      RATE_LIMIT_MAX: number;
      UPLOAD_DIRNAME: string;
      UPLOAD_TASKS_DIRNAME: string;
      REDIS_HOST: string;
      REDIS_PORT: number;
      REDIS_PASSWORD?: string;
      REDIS_DB: number;
    };
  }
}

const schema = {
  type: 'object',
  required: [
    'NODE_ENV',
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE'
  ],
  properties: {
    PORT: {
      type: 'number',
      default: 3000
    },
    NODE_ENV: {
      type: 'string',
      default: 'development'
    },
    
    // Database
    MYSQL_HOST: {
      type: 'string',
      default: 'localhost'
    },
    MYSQL_PORT: {
      type: 'number',
      default: 3306
    },
    MYSQL_USER: {
      type: 'string'
    },
    MYSQL_PASSWORD: {
      type: 'string'
    },
    MYSQL_DATABASE: {
      type: 'string'
    },

    // Database Security
    CAN_CREATE_DATABASE: {
      type: 'number',
      default: 0
    },
    CAN_DROP_DATABASE: {
      type: 'number',
      default: 0
    },
    CAN_SEED_DATABASE: {
      type: 'number',
      default: 0
    },

    // Server
    FASTIFY_CLOSE_GRACE_DELAY: {
      type: 'number',
      default: 1000
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info'
    },

    // Security
    COOKIE_SECRET: {
      type: 'string'
    },
    COOKIE_NAME: {
      type: 'string'
    },
    COOKIE_SECURED: {
      type: 'boolean',
      default: false
    },
    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100
    },

    // Files
    UPLOAD_DIRNAME: {
      type: 'string',
      minLength: 1,
      pattern: '^(?!.*\\.{2}).*$',
      default: 'uploads'
    },
    UPLOAD_TASKS_DIRNAME: {
      type: 'string',
      default: 'tasks'
    },

    // Redis
    REDIS_HOST: {
      type: 'string',
      default: 'localhost'
    },
    REDIS_PORT: {
      type: 'number',
      default: 6379
    },
    REDIS_PASSWORD: {
      type: 'string'
    },
    REDIS_DB: {
      type: 'number',
      default: 0
    }
  }
}

export const autoConfig = {
  // Decorate Fastify instance with `config` key
  // Optional, default: 'config'
  confKey: 'config',

  // Schema to validate
  schema,

  // Needed to read .env in root folder
  dotenv: true,

  // Source for the configuration data
  // Optional, default: process.env
  data: process.env
}

/**
 * This plugins helps to check environment variables.
 *
 * @see {@link https://github.com/fastify/fastify-env}
 */
export default fp(async function (fastify, opts) {
  await fastify.register(env, autoConfig)
}, {
  name: 'env'
})