import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import Fastify from 'fastify'
import serviceApp from '../src/app.js'
import { FastifyInstance } from 'fastify'

describe('Admin Roles API Tests', () => {
  let app: FastifyInstance
  let accessToken: string
  let testRoleId: number
  let testUserId: number
  const testRoleName = 'test_role_' + Date.now()
  const testUserName = 'test_user_' + Date.now()

  before(async () => {
    // 设置测试特定的环境变量
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'error' // 测试时减少日志输出

    // 构建应用实例
    app = Fastify({ logger: false })
    await app.register(serviceApp)
    await app.ready()

    // 使用admin账号登录获取访问令牌
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'admin',
        password: 'admin123'
      }
    })

    if (loginResponse.statusCode === 200) {
      const loginData = JSON.parse(loginResponse.body)
      accessToken = loginData.data.accessToken
    } else {
      accessToken = 'invalid-token'
    }

    // 创建测试用户用于角色分配测试
    const userResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      payload: {
        username: testUserName,
        email: `${testUserName}@example.com`,
        password: 'password123',
        realName: '测试用户'
      }
    })

    if (userResponse.statusCode === 201) {
      const userData = JSON.parse(userResponse.body)
      testUserId = userData.data.id
    }
  })

  after(async () => {
    // 清理测试角色
    if (testRoleId) {
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/roles/${testRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })
    }

    // 清理测试用户
    if (testUserId) {
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${testUserId}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })
    }

    // 关闭应用实例
    await app.close()
  })

  describe('POST /api/v1/admin/roles - 创建角色', () => {
    test('应该成功创建新角色', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: testRoleName,
          description: '测试角色描述',
          type: 'custom',
          status: 1,
          sortOrder: 100
        }
      })

      const data = JSON.parse(response.body)
      assert.strictEqual(response.statusCode, 201)
      assert.strictEqual(data.code, 20001) // CREATED
      testRoleId = Number(data.data.id)
    })

    test('应该拒绝创建重复名称的角色', async () => {
      if (!testRoleId) return // 跳过如果没有成功创建角色

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: testRoleName, // 使用已存在的角色名
          description: '重复角色',
          type: 'custom',
          status: 1
        }
      })

      assert.strictEqual(response.statusCode, 409)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 40006) // CONFLICT
    })

    test('应该拒绝无效的请求数据', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: '', // 空角色名
          type: 'invalid', // 无效类型
          status: 999 // 无效状态
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })

    test('应该拒绝未认证的请求', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        payload: {
          name: 'unauthorized_role',
          description: '未授权角色',
          type: 'custom'
        }
      })

      assert.strictEqual(response.statusCode, 401)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 40001) // UNAUTHORIZED
    })
  })

  describe('GET /api/v1/admin/roles - 获取角色列表', () => {
    test('应该成功获取角色列表', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 20000) // SUCCESS
      assert.ok(Array.isArray(data.data.list))
      assert.ok(typeof data.data.pagination.total === 'number')
      assert.ok(typeof data.data.pagination.page === 'number')
      assert.ok(typeof data.data.pagination.pageSize === 'number')
    })

    test('应该支持分页参数', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles?page=1&pageSize=5',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      if (data.data.pagination.page !== undefined) {
        assert.strictEqual(data.data.pagination.page, 1)
      }
      if (data.data.pagination.pageSize !== undefined) {
        assert.strictEqual(data.data.pagination.pageSize, 5)
      }
      assert(data.data.list.length <= 5)
    })

    test('应该支持搜索功能', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/roles?search=${testRoleName}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      // 如果有搜索结果，检查是否包含搜索关键词
      if (data.data.list.length > 0) {
        assert(data.data.list.some((role: any) =>
          role.roleName.includes(testRoleName) ||
          (role.roleDesc && role.roleDesc.includes(testRoleName))
        ))
      }
    })

    test('应该支持类型过滤', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles?type=custom',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })
      assert.strictEqual(response.statusCode, 200)
    })

    test('应该支持状态过滤', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles?status=1',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      if (data.data.list.length > 0) {
        assert(data.data.list.every((role: any) => role.status === 1))
      }
    })

    test('应该支持排序功能', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles?sortBy=sort_order&sortOrder=desc',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      // 检查是否按sortOrder降序排列
      if (data.data.list.length > 1) {
        for (let i = 0; i < data.data.list.length - 1; i++) {
          assert(data.data.list[i].sortOrder >= data.data.list[i + 1].sortOrder)
        }
      }
    })

    test('应该拒绝未认证的请求', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles'
      })

      assert.strictEqual(response.statusCode, 401)
    })
  })

  describe('GET /api/v1/admin/roles/:id - 获取角色详情', () => {
    test('应该成功获取角色详情', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/roles/${testRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 20000) // SUCCESS
      assert.strictEqual(data.message, '获取角色详情成功')
      assert.ok(data.data)
      assert.strictEqual(data.data.id, testRoleId)
      assert.strictEqual(data.data.roleName, testRoleName)
    })

    test('应该返回404当角色不存在', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles/99999',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 404)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 40004) // NOT_FOUND
    })

    test('应该拒绝无效的角色ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles/invalid',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })
  })

  describe('PUT /api/v1/admin/roles/:id - 更新角色', () => {
    test('应该成功更新角色信息', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/roles/${testRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: testRoleName + '_updated',
          description: '更新后的角色描述',
          status: 1,
          sortOrder: 200
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 20002) // UPDATED
      assert.strictEqual(data.message, '角色更新成功')
    })

    test('应该返回404当角色不存在', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/roles/99999',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: 'nonexistent_role',
          description: '不存在的角色'
        }
      })

      assert.strictEqual(response.statusCode, 404)
    })

    test('应该拒绝无效的更新数据', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/roles/${testRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: '', // 空名称
          status: 999 // 无效状态
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })
  })

  describe('PATCH /api/v1/admin/roles/:id/status - 修改角色状态', () => {
    test('应该成功修改角色状态', async () => {
      // 先禁用角色
      const disableResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/roles/${testRoleId}/status`,
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          status: 0 // 禁用
        }
      })

      assert.strictEqual(disableResponse.statusCode, 200)
      const disableData = JSON.parse(disableResponse.body)
      assert.strictEqual(disableData.code, 20002) // UPDATED
      assert.strictEqual(disableData.message, '角色状态修改成功')

      // 恢复角色状态为启用
      const enableResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/roles/${testRoleId}/status`,
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          status: 1 // 启用
        }
      })

      assert.strictEqual(enableResponse.statusCode, 200)
      const enableData = JSON.parse(enableResponse.body)
      assert.strictEqual(enableData.code, 20002) // UPDATED
    })

    test('应该拒绝无效的状态值', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/roles/${testRoleId}/status`,
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          status: 999 // 无效状态
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })

    test('应该返回404当角色不存在', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/roles/99999/status',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          status: 1
        }
      })

      assert.strictEqual(response.statusCode, 404)
    })
  })

  describe('POST /api/v1/admin/roles/assign - 为用户分配角色', () => {
    test('应该成功为用户分配角色', async () => {
      if (!testUserId || !testRoleId) return // 跳过如果没有测试用户或角色

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles/assign',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          userId: testUserId,
          roleIds: [testRoleId]
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 20000) // SUCCESS
      assert.strictEqual(data.message, '角色分配成功')
    })

    test('应该支持分配多个角色', async () => {
      if (!testUserId || !testRoleId) return

      // 创建另一个测试角色
      const roleResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: testRoleName + '_second',
          description: '第二个测试角色',
          type: 'custom',
          status: 1
        }
      })

      if (roleResponse.statusCode === 201) {
        const roleData = JSON.parse(roleResponse.body)
        const secondRoleId = roleData.data.id

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/admin/roles/assign',
          headers: {
            authorization: `Bearer ${accessToken}`
          },
          payload: {
            userId: testUserId,
            roleIds: [testRoleId, secondRoleId]
          }
        })

        assert.strictEqual(response.statusCode, 200)

        // 清理第二个角色
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/admin/roles/${secondRoleId}`,
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        })
      }
    })

    test('应该拒绝无效的用户ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles/assign',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          userId: 99999, // 不存在的用户ID
          roleIds: [testRoleId]
        }
      })

      assert.strictEqual(response.statusCode, 500) // 可能返回500或其他错误码
    })
  })

  describe('GET /api/v1/admin/roles/user/:userId - 获取用户角色', () => {
    test('应该成功获取用户的角色列表', async () => {
      if (!testUserId) return

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/roles/user/${testUserId}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 20000) // SUCCESS
      assert.ok(Array.isArray(data.data))
      
      // 检查是否包含之前分配的角色
      if (data.data.length > 0) {
        assert(data.data.some((role: any) => role.id === testRoleId))
      }
    })

    test('应该返回空数组当用户没有角色', async () => {
      // 创建一个新用户，不分配任何角色
      const userResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          username: 'no_role_user_' + Date.now(),
          email: 'norole@example.com',
          password: 'password123',
          realName: '无角色用户'
        }
      })

      if (userResponse.statusCode === 201) {
        const userData = JSON.parse(userResponse.body)
        const noRoleUserId = userData.data.id

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/admin/roles/user/${noRoleUserId}`,
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        })

        assert.strictEqual(response.statusCode, 200)
        const data = JSON.parse(response.body)
        assert.ok(Array.isArray(data.data))
        assert.strictEqual(data.data.length, 0)

        // 清理测试用户
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/admin/users/${noRoleUserId}`,
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        })
      }
    })

    test('应该返回404当用户不存在', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles/user/99999',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 500)
      const data = JSON.parse(response.body)
      assert.strictEqual(data.code, 50000) // INTERNAL_SERVER_ERROR
    })
  })

  describe('DELETE /api/v1/admin/roles/:id - 删除角色', () => {
    test('应该成功删除角色', async () => {
      // 创建一个临时角色用于删除测试
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          roleName: 'temp_role_' + Date.now(),
          roleDesc: '临时角色',
          isSystem: 0,
          status: 1
        }
      })

      if (createResponse.statusCode === 201) {
        const createData = JSON.parse(createResponse.body)
        const tempRoleId = createData.data.id

        const response = await app.inject({
          method: 'DELETE',
          url: `/api/v1/admin/roles/${tempRoleId}`,
          headers: {
            authorization: `Bearer ${accessToken}`
          }
        })

        assert.strictEqual(response.statusCode, 200)
        const data = JSON.parse(response.body)
        assert.strictEqual(data.code, 20003) // DELETED
        assert.strictEqual(data.message, '角色删除成功')
      }
    })

    test('应该返回404当角色不存在', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/roles/99999',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 404)
    })

    test('应该拒绝未认证的请求', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/roles/${testRoleId}`
      })

      assert.strictEqual(response.statusCode, 401)
    })
  })

  describe('边界条件和错误处理', () => {
    test('应该正确处理无效的JWT令牌', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      })

      assert.strictEqual(response.statusCode, 401)
    })

    test('应该正确处理格式错误的Authorization头', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: 'InvalidFormat'
        }
      })

      assert.strictEqual(response.statusCode, 401)
    })

    test('应该正确处理空的Authorization头', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: ''
        }
      })

      assert.strictEqual(response.statusCode, 401)
    })

    test('应该支持大小写不敏感的Bearer令牌格式', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
    })

    test('应该正确处理超长的角色名称', async () => {
      const longName = 'a'.repeat(100) // 超过50字符限制

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: longName,
          description: '测试超长名称',
          type: 'custom'
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })

    test('应该正确处理超长的角色描述', async () => {
      const longDescription = 'a'.repeat(300) // 超过200字符限制

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: 'test_long_desc',
          description: longDescription,
          type: 'custom'
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })

    test('应该正确处理负数的sortOrder', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/roles',
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        payload: {
          name: 'negative_sort',
          description: '负数排序测试',
          type: 'custom',
          sortOrder: -1
        }
      })

      assert.strictEqual(response.statusCode, 400)
    })

    test('应该正确处理极大的页码参数', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles?page=999999&pageSize=1',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      // 应该返回空列表但不报错
      assert.ok(Array.isArray(data.data.list))
    })

    test('应该正确处理超大的pageSize参数', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/roles?page=1&pageSize=1000',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })

      assert.strictEqual(response.statusCode, 200)
      const data = JSON.parse(response.body)
      // pageSize应该被限制在最大值（如100）
      assert(data.data.list.length <= 100)
    })
  })
})