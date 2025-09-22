import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UserService } from '../services/userService.js'
import { CreateUserDTO, UpdateUserDTO, UserQueryDTO } from '../domain/user.js'

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify)

  // 创建用户
  fastify.post('/users', async (
    request: FastifyRequest<{ Body: CreateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const newUser = await userService.createUser(request.body)
      return reply.code(201).send({
        message: 'User created successfully',
        user: newUser
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return reply.code(409).send({ error: 'Conflict', message: error.message })
        }
      }
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to create user' })
    }
  })

  // 获取所有用户
  fastify.get('/users', async (
    request: FastifyRequest<{ Querystring: UserQueryDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await userService.getUsers(request.query)
      return reply.send(result)
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch users' })
    }
  })

  // 根据ID获取用户
  fastify.get('/users/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const user = await userService.getUserById(parseInt(request.params.id))
      if (!user) {
        return reply.code(404).send({ error: 'Not Found', message: `User with ID ${request.params.id} not found` })
      }
      return reply.send({ user })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to fetch user' })
    }
  })

  // 更新用户信息
  fastify.put('/users/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const updatedUser = await userService.updateUser(parseInt(request.params.id), request.body)
      if (!updatedUser) {
        return reply.code(404).send({ error: 'Not Found', message: `User with ID ${request.params.id} not found` })
      }
      return reply.send({ message: 'User updated successfully', user: updatedUser })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to update user' })
    }
  })

  // 删除用户
  fastify.delete('/users/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const success = await userService.deleteUser(parseInt(request.params.id))
      if (!success) {
        return reply.code(404).send({ error: 'Not Found', message: `User with ID ${request.params.id} not found` })
      }
      return reply.send({ message: 'User deleted successfully' })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to delete user' })
    }
  })

  // 清除缓存
  fastify.post('/users/cache/clear', async (_request, reply) => {
    try {
      await userService.clearCache()
      return reply.send({ message: 'Cache cleared successfully' })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to clear cache' })
    }
  })
}
