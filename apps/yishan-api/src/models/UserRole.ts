import { Model, QueryBuilder } from 'objection'

export class UserRole extends Model {
  static tableName = 'sys_user_role'
  static idColumn = 'id'

  // 属性定义 - 使用 camelCase，knexSnakeCaseMappers 会自动转换为 snake_case
  id!: number
  userId!: number
  roleId!: number
  status!: number
  creatorId?: number | null
  updaterId?: number | null
  assignedAt?: string | null
  expiresAt?: string | null
  createdAt!: string
  updatedAt!: string
  deletedAt?: string | null

  // JSON Schema 验证
  static jsonSchema = {
    type: 'object',
    required: ['userId', 'roleId', 'status'],
    properties: {
      id: { type: 'integer' },
      userId: { type: 'integer' },
      roleId: { type: 'integer' },
      status: { type: 'integer' },
      creatorId: { type: ['integer', 'null'] },
      updaterId: { type: ['integer', 'null'] },
      assignedAt: { type: ['string', 'null'] },
      expiresAt: { type: ['string', 'null'] },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
      deletedAt: { type: ['string', 'null'] }
    }
  }

  // 关系映射
  static relationMappings = {
    // 用户
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => require('./User.js').User,
      join: {
        from: 'sys_user_role.userId',
        to: 'sys_user.id'
      }
    },
    // 角色
    role: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => require('./Role.js').Role,
      join: {
        from: 'sys_user_role.roleId',
        to: 'sys_role.id'
      }
    },
    // 分配者
    assigner: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => require('./User.js').User,
      join: {
        from: 'sys_user_role.creatorId',
        to: 'sys_user.id'
      }
    }
  }

  // 查询修饰符
  static modifiers = {
    // 未过期的记录
    notExpired(query: QueryBuilder<UserRole>) {
      query.where(function() {
        this.whereNull('expiresAt').orWhere('expiresAt', '>', new Date().toISOString())
      })
    },
    // 已过期的记录
    expired(query: QueryBuilder<UserRole>) {
      query.whereNotNull('expiresAt').where('expiresAt', '<=', new Date().toISOString())
    },
    // 按用户ID筛选
    byUser(query: QueryBuilder<UserRole>, userId: number) {
      query.where('userId', userId)
    },
    // 按角色ID筛选
    byRole(query: QueryBuilder<UserRole>, roleId: number) {
      query.where('roleId', roleId)
    },
    // 按分配时间排序
    orderByAssigned(query: QueryBuilder<UserRole>) {
      query.orderBy('assignedAt', 'desc')
    }
  }

  // 实例方法
  isExpired(): boolean {
    if (!this.expiresAt) return false
    return new Date(this.expiresAt) <= new Date()
  }

  isActive(): boolean {
    return !this.isExpired()
  }

  // 设置过期时间
  async setExpiration(expiresAt: string | null, updaterId?: number): Promise<void> {
    await this.$query().patch({
      expiresAt,
      updatedAt: new Date().toISOString()
    })
  }

  // 延长有效期
  async extend(days: number, updaterId?: number): Promise<void> {
    const currentExpiry = this.expiresAt ? new Date(this.expiresAt) : new Date()
    const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000)
    
    await this.setExpiration(newExpiry.toISOString(), updaterId)
  }

  // 生命周期钩子
  $beforeInsert(): void {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
    
    if (!this.assignedAt) {
      this.assignedAt = now
    }
  }

  $beforeUpdate(): void {
    this.updatedAt = new Date().toISOString()
  }
}