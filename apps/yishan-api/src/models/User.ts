import { Model, QueryBuilder } from 'objection'
import { DateTimeUtil } from '../utils/datetime.js'

export enum UserStatus {
  DISABLED = 0,
  ENABLED = 1,
  LOCKED = 2
}

export enum Gender {
  UNKNOWN = 0,
  MALE = 1,
  FEMALE = 2
}

export class User extends Model {
  static tableName = 'sys_user'
  static idColumn = 'id'

  // 属性定义 - 使用 camelCase，knexSnakeCaseMappers 会自动转换为 snake_case
  id!: number
  username!: string
  email!: string
  phone?: string | null
  passwordHash!: string
  salt!: string
  realName!: string
  avatar?: string | null
  gender!: Gender
  birthDate?: string | null
  status!: UserStatus
  lastLoginTime?: string | null
  lastLoginIp?: string | null
  loginCount!: number
  creatorId?: number | null
  createdAt!: string
  updaterId?: number | null
  updatedAt!: string
  deletedAt?: string | null
  version!: number

  // JSON Schema 验证
  static jsonSchema = {
    type: 'object',
    required: ['username', 'email', 'passwordHash', 'salt', 'realName', 'status'],
    properties: {
      id: { type: 'integer' },
      username: { type: 'string', minLength: 2, maxLength: 50 },
      email: { type: 'string', format: 'email', maxLength: 100 },
      phone: { type: ['string', 'null'], maxLength: 20 },
      passwordHash: { type: 'string', maxLength: 255 },
      salt: { type: 'string', maxLength: 32 },
      realName: { type: 'string', minLength: 1, maxLength: 50 },
      avatar: { type: ['string', 'null'], maxLength: 500 },
      gender: { type: 'integer', enum: Object.values(Gender) },
      birthDate: { type: ['string', 'null'], format: 'date' },
      status: { type: 'integer', enum: Object.values(UserStatus) },
      lastLoginTime: { type: ['string', 'null'] },
      lastLoginIp: { type: ['string', 'null'], maxLength: 45 },
      loginCount: { type: 'integer', minimum: 0 },
      creatorId: { type: ['integer', 'null'] },
      createdAt: { type: 'string' },
      updaterId: { type: ['integer', 'null'] },
      updatedAt: { type: 'string' },
      deletedAt: { type: ['string', 'null'] },
      version: { type: 'integer', minimum: 1 }
    }
  }

  // 关系映射
  static relationMappings = {
    // 多对多关系：用户 <-> 角色
    roles: {
      relation: Model.ManyToManyRelation,
      modelClass: () => require('./Role.js').Role,
      join: {
        from: 'sys_user.id',
        through: {
          from: 'sys_user_role.user_id',
          to: 'sys_user_role.role_id'
        },
        to: 'sys_role.id'
      }
    },
    // 用户角色关联记录
    userRoles: {
      relation: Model.HasManyRelation,
      modelClass: () => require('./UserRole.js').UserRole,
      join: {
        from: 'sys_user.id',
        to: 'sys_user_role.user_id'
      }
    },
    // 创建者
    creator: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'sys_user.creator_id',
        to: 'sys_user.id'
      }
    },
    // 更新者
    updater: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => User,
      join: {
        from: 'sys_user.updater_id',
        to: 'sys_user.id'
      }
    }
  }

  // 查询修饰符
  static modifiers = {
    // 未删除的记录
    notDeleted(query: QueryBuilder<User>) {
      query.whereNull('deleted_at')
    },
    // 启用状态的用户
    active(query: QueryBuilder<User>) {
      query.where('status', UserStatus.ENABLED)
    },
    // 按用户名搜索
    searchByUsername(query: QueryBuilder<User>, keyword: string) {
      query.where('username', 'like', `%${keyword}%`)
    },
    // 按真实姓名搜索
    searchByRealName(query: QueryBuilder<User>, keyword: string) {
      query.where('real_name', 'like', `%${keyword}%`)
    },
    // 按邮箱搜索
    searchByEmail(query: QueryBuilder<User>, keyword: string) {
      query.where('email', 'like', `%${keyword}%`)
    },
    // 按创建时间排序
    orderByCreated(query: QueryBuilder<User>) {
      query.orderBy('created_at', 'desc')
    }
  }

  // 实例方法
  isActive(): boolean {
    return this.status === UserStatus.ENABLED
  }

  isLocked(): boolean {
    return this.status === UserStatus.LOCKED
  }

  isDisabled(): boolean {
    return this.status === UserStatus.DISABLED
  }

  // 软删除
  async softDelete(deleterId?: number): Promise<void> {
    await this.$query().patch({
      deletedAt: DateTimeUtil.now(),
      updaterId: deleterId || null
    })
  }

  // 更新登录信息
  async updateLoginInfo(ip: string): Promise<void> {
    await this.$query().patch({
      lastLoginTime: DateTimeUtil.now(),
      lastLoginIp: ip,
      loginCount: this.loginCount + 1
    })
  }

  // 生命周期钩子
  $beforeInsert(): void {
    const now = DateTimeUtil.now()
    this.createdAt = now
    this.updatedAt = now
    this.loginCount = this.loginCount || 0
    this.version = this.version || 1
    this.gender = this.gender || Gender.UNKNOWN
    this.status = this.status || UserStatus.ENABLED
  }

  $beforeUpdate(): void {
    this.updatedAt = DateTimeUtil.now()
    this.version = (this.version || 1) + 1
  }
}