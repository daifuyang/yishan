import { join } from 'node:path'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all external plugins defined in plugins/external
  // those should be registered first as your application plugins might depend on them
  await fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, 'plugins/external'),
    options: {}
  })

  // This loads all your application plugins defined in plugins/app
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, 'plugins/app'),
    options: { ...opts }
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(import.meta.dirname, 'routes'),
    autoHooks: true,
    cascadeHooks: true,
    options: opts
  })
}

export default app
export { app, options }
