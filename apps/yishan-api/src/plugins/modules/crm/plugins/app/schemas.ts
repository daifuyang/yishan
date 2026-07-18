import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import registerCrmSchemas from '../../schemas/crm.js'

/** Registers CRM's API contracts before its autoloaded route tree. */
const crmSchemas: FastifyPluginAsync = async (fastify) => {
  registerCrmSchemas(fastify)
}

// Schema registrations must be visible to the sibling route autoloader.
// fastify-plugin deliberately removes this plugin's encapsulation boundary.
export default fp(crmSchemas, { name: 'crm-schemas' })
