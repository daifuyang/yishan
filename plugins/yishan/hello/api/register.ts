// hello plugin API runtime entry — the single mount point Core awaits.
//
// Contract (PLUGIN_CONTRACT.md §9 / ADR-003): the default export is a
// Fastify plugin. Core imports this module via `manifest.api.register()`,
// mounts the default export under `manifest.api.prefix`
// (`/api/plugins/yishan/hello/v1`) INSIDE the Core-owned plugin gate, and
// the plugin never wires the gate itself. Sub-routes registered here use
// prefixes relative to `api.prefix`, so everything stays under it.

import type { FastifyPluginAsync } from '@yishan/plugin-api'
import helloAdminRoutes from './routes/v1/admin/index.js'

const register: FastifyPluginAsync = async (app) => {
  await app.register(helloAdminRoutes, { prefix: '/admin' })
}

export default register
