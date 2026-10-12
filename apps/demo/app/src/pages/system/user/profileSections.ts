export const UNSET = '未设置'
const UNRESOLVED = '名称暂不可用'

export type ProfileOrgTarget = 'departments' | 'roles'

export type ProfileField =
  | { kind: 'text'; key: string; label: string; value: string; editable: boolean }
  | { kind: 'date'; key: string; label: string; value: string; editable: boolean }
  | { kind: 'secret'; key: string; label: string; value: string }
  | { kind: 'enum'; key: string; label: string; value: string; options: readonly string[] }
  | {
      kind: 'org'
      key: string
      label: string
      ids: number[]
      names: Map<number, string>
      target: ProfileOrgTarget
    }

export interface ProfileSection {
  key: string
  title: string
  fields: ProfileField[]
}

/** 与后端 gender 取值一致：0 保密 / 1 男 / 2 女。数组下标即 value。 */
export const GENDER_OPTIONS = ['保密', '男', '女'] as const
/** 与后端 status 取值一致：0 禁用 / 1 启用 / 2 锁定。数组下标即 value。 */
export const STATUS_OPTIONS = ['禁用', '启用', '锁定'] as const

export function maskSecret(value: string): string {
  return value ? '••••••••' : ''
}

/**
 * 组织归属摘要：最多展示 2 个名称，溢出时补「等 N 个」。
 * 名称解析不出的项保留「名称暂不可用」占位（沿用既有行为），
 * 避免静默隐藏关联缺失；占位项计入总数但不产生空的顿号串。
 */
export function formatOrgSummary(ids: number[], names: Map<number, string>): string {
  if (!ids.length) return UNSET
  const resolved = ids.map((id) => names.get(id)).filter((name): name is string => !!name)
  const shown = resolved.length < ids.length ? [...resolved, UNRESOLVED] : resolved
  if (shown.length <= 2) return shown.join('、')
  // 计数用实际选中项数量，占位文案不代表一个部门
  return `${shown.slice(0, 2).join('、')} 等 ${ids.length} 个`
}

function text(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value)
  return s || UNSET
}

export interface BuildProfileOptions {
  user: Record<string, unknown>
  deptNames: Map<number, string>
  roleNames: Map<number, string>
  canReadDepts: boolean
  canReadRoles: boolean
}

export function buildProfileSections(options: BuildProfileOptions): ProfileSection[] {
  const { user, deptNames, roleNames, canReadDepts, canReadRoles } = options
  const ids = (key: 'deptIds' | 'roleIds'): number[] =>
    Array.isArray(user[key]) ? (user[key] as number[]) : []

  // 无读取权限时整组不进契约，而不是留一个空占位
  const orgFields: ProfileField[] = []
  if (canReadDepts) {
    orgFields.push({
      kind: 'org',
      key: 'depts',
      label: '所属部门',
      ids: ids('deptIds'),
      names: deptNames,
      target: 'departments',
    })
  }
  if (canReadRoles) {
    orgFields.push({
      kind: 'org',
      key: 'roles',
      label: '角色',
      ids: ids('roleIds'),
      names: roleNames,
      target: 'roles',
    })
  }

  const sections: ProfileSection[] = [
    {
      key: 'basic',
      title: '基础信息',
      fields: [
        { kind: 'text', key: 'username', label: '用户名', value: text(user.username), editable: true },
        { kind: 'text', key: 'realName', label: '真实姓名', value: text(user.realName), editable: true },
        { kind: 'text', key: 'nickname', label: '昵称', value: text(user.nickname), editable: true },
      ],
    },
    {
      key: 'contact',
      title: '联系方式',
      fields: [
        { kind: 'text', key: 'phone', label: '手机号', value: text(user.phone), editable: true },
        { kind: 'text', key: 'email', label: '邮箱', value: text(user.email), editable: true },
      ],
    },
    {
      key: 'security',
      title: '安全设置',
      fields: [
        // 密码是「可填但不回显」的字段：编辑态留空表示不修改，
        // 因此这里始终给出可填的原值，由渲染层决定如何呈现。
        { kind: 'secret', key: 'password', label: '密码', value: String(user.password ?? '') },
      ],
    },
    { key: 'org', title: '组织关系', fields: orgFields },
    {
      key: 'status',
      title: '状态',
      fields: [
        {
          kind: 'enum',
          key: 'status',
          label: '启用状态',
          value: String(user.status ?? '0'),
          options: STATUS_OPTIONS,
        },
      ],
    },
    {
      key: 'extra',
      title: '其他属性',
      fields: [
        {
          kind: 'enum',
          key: 'gender',
          label: '性别',
          value: String(user.gender ?? '0'),
          options: GENDER_OPTIONS,
        },
        { kind: 'date', key: 'birthDate', label: '出生日期', value: text(user.birthDate), editable: true },
      ],
    },
  ]

  // 无权限的分组会变成空数组，不要留下空标题
  return sections.filter((section) => section.fields.length > 0)
}