import fp from 'fastify-plugin'
import multipart, { FastifyMultipartOptions } from '@fastify/multipart'

export default fp<FastifyMultipartOptions>(async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024,
      fields: 20,
      fileSize: 50 * 1024 * 1024,
      files: 20,
      headerPairs: 2000
    },
    attachFieldsToBody: false,
    throwFileSizeLimit: true
  })
}, {
  name: 'multipart'
})

