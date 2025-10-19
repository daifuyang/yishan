import path from "node:path";
import fastifyAutoload from "@fastify/autoload";
import { FastifyInstance, FastifyPluginOptions } from "fastify";

export const options = {
  ajv: {
    customOptions: {
      coerceTypes: true,
      removeAdditional: "all",
    },
  },
};

export default async function serviceApp(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  delete opts.skipOverride; // This option only serves testing purpose

  // This loads all external plugins defined in plugins/external
  // those should be registered first as your application plugins might depend on them
  await fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, "plugins/external"),
    options: {},
  });

  // This loads all your application plugins defined in plugins/app
  // those should be support plugins that are reused
  // through your application
  fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, "plugins/app"),
    options: { ...opts },
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(fastifyAutoload, {
    dir: path.join(import.meta.dirname, "routes"),
    autoHooks: true,
    cascadeHooks: true,
    options: { ...opts },
  });

  // Global error handler
  fastify.setErrorHandler((err, request, reply) => {
    request.log.error(
      {
        error: {
          message: err.message,
          stack: err.stack,
          statusCode: err.statusCode,
        },
        request: {
          method: request.method,
          url: request.url,
          query: request.query,
          params: request.params,
        },
      },
      "Unhandled error occurred"
    );

    reply.code(err.statusCode ?? 500);

    let message = "Internal Server Error";
    if (err.statusCode && err.statusCode < 500) {
      message = err.message;
    }

    // 使用 ResponseUtil.error 返回统一的错误响应格式
    return reply.sendError(message, err.statusCode ?? 500);
  });

  // An attacker could search for valid URLs if your 404 error handling is not rate limited.
  fastify.setNotFoundHandler(
    {
      preHandler: fastify.rateLimit?.({
        max: 3,
        timeWindow: 500,
      }),
    },
    (request, reply) => {
      request.log.warn(
        {
          request: {
            method: request.method,
            url: request.url,
            query: request.query,
            params: request.params,
          },
        },
        "Resource not found"
      );

      reply.code(404);

      return { message: "Not Found" };
    }
  );
}
