import { Model, QueryBuilder } from 'objection'
import { DateTimeUtil } from '../utils/datetime.js'
import { RoleStatus, RoleType } from '../domain/role.js'

export class Role extends Model {
  static tableName = 'sys_role'
  static idColumn = 'id'

  // 属性定义 - 使用 camelCase，knexSnakeCaseMappers 会自动转换为 snake_case
  id!: number
  roleName!: string
  roleDesc?: string | null
  status!: RoleStatus
  isSystem?: number
  sortOrder!: number
  creatorId?: number | null
  updaterId?: number | null
  createdAt!: string
  updatedAt!: string
  deletedAt?: string | null

  // JSON Schema 验证
  static jsonSchema = {
    type: 'object',
    required: ['roleName', 'status', 'sortOrder'],
    properties: {
      id: { type: 'integer' },
      roleName: { type: 'string', minLength: 2, maxLength: 50 },
      roleDesc: { type: ['string', 'null'], maxLength: 200 },
      status: { type: 'integer', enum: Object.values(RoleStatus) },
      isSystem: { type: 'integer', enum: [0, 1], default: 0 },
      sortOrder: { type: 'integer', minimum: 0 },
      creatorId: { type: ['integer', 'null'] },
      updaterId: { type: ['integer', 'null'] },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
      deletedAt: { type: ['string', 'null'] }
    }
  }

  // 关系映射
  static relationMappings = {
    // 多对多关系：角色与用户
    users: {
      relation: Model.ManyToManyRelation,
      modelClass: () => require('./User.js').User,
      join: {
        from: 'sys_role.id',
        through: {
          from: 'sys_user_role.roleId',
          to: 'sys_user_role.userId'
        },
        to: 'sys_user.id'
      }
    },
    // 创建者
    creator: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => require('./User.js').User,
      join: {
        from: 'sys_role.creatorId',
        to: 'sys_user.id'
      }
    },
    // 更新者
    updater: {
      relation: Model.BelongsToOneRelation,
      modelClass: () => require('./User.js').User,
      join: {
        from: 'sys_role.updaterId',
        to: 'sys_user.id'
      }
    }
  }

  // 查询修饰符
  static modifiers = {
    // 未删除的记录
    notDeleted(query: QueryBuilder<Role>) {
      query.whereNull('deletedAt')
    },
    // 启用状态的角色
    active(query: QueryBuilder<Role>) {
      query.where('status', RoleStatus.ENABLED)
    },
    // 系统角色
    system(query: QueryBuilder<Role>) {
      query.where('isSystem', 1)
    },
    // 非系统角色
    nonSystem(query: QueryBuilder<Role>) {
      query.where('isSystem', 0)
    },
    // 按排序顺序排序
    orderBySort(query: QueryBuilder<Role>) {
      query.orderBy('sortOrder', 'asc').orderBy('id', 'asc')
    }
  }

  // 实例方法
  isSystemRole(): boolean {
    return this.isSystem === 1
  }

  isActive(): boolean {
    return this.status === RoleStatus.ENABLED
  }

  getType(): RoleType {
    return this.isSystem === 1 ? RoleType.SYSTEM : RoleType.CUSTOM
  }

  // 软删除
  async softDelete(deleterId?: number): Promise<void> {
    await this.$query().patch({
      deletedAt: DateTimeUtil.now(),  // 使用DateTimeUtil工具类生成MySQL兼容格式
      updaterId: deleterId || null
    })
  }

  // 切换状态
  async toggleStatus(updaterId?: number): Promise<void> {
    const newStatus = this.status === RoleStatus.ENABLED ? RoleStatus.DISABLED : RoleStatus.ENABLED
    await this.$query().patch({
      status: newStatus,
      updaterId: updaterId || null
    })
  }

  // 生命周期钩子
  $beforeInsert(): void {
    this.createdAt = DateTimeUtil.now()
    this.updatedAt = DateTimeUtil.now()
  }

  $beforeUpdate(): void {
    this.updatedAt = DateTimeUtil.now()
  }
}