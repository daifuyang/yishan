/**
 * 用户相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 用户基础信息 Schema
const SysUserSchema = Type.Object(
  {
    id: Type.Number({ description: "用户ID", example: 1 }),
    username: Type.Optional(Type.String({ description: "用户名", example: "admin" })),
    email: Type.Optional(Type.String({
      format: "email",
      description: "邮箱",
      example: "admin@yishan.com",
    })),
    phone: Type.String({ description: "手机号", example: "8888888" }),
    realName: Type.Optional(Type.String({ description: "真实姓名", example: "愚公" })),
    nickname: Type.Optional(Type.String({ description: "昵称", example: "愚公移山", maxLength: 50 })),
    avatar: Type.Optional(Type.String({ description: "头像URL" })),
    gender: Type.String({
      enum: ["0", "1", "2"],
      description: "性别（0-未知，1-男，2-女）",
      example: "1",
    }),
    genderName: Type.String({ description: "性别名称", example: "男" }),
    birthDate: Type.Optional(
      Type.String({
        format: "date",
        description: "出生日期",
        example: "2008-08-08",
      })
    ),
    status: Type.String({
      enum: ["0", "1", "2"],
      description: "状态（0-禁用，1-启用，2-锁定）",
      example: "1",
    }),
    statusName: Type.String({ description: "状态名称", example: "启用" }),
    lastLoginTime: Type.Optional(
      Type.String({ format: "date-time", description: "最后登录时间" })
    ),
    lastLoginIp: Type.Optional(
      Type.String({ description: "最后登录IP", example: "127.0.0.1" })
    ),
    loginCount: Type.Number({ description: "登录次数", example: "8" }),
    creatorId: Type.Number({ description: "创建人Id", example: 1 }),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Number({ description: "更新人Id", example: 1 }),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    deptIds: Type.Optional(Type.Array(Type.Number(), { description: "部门ID列表" })),
    roleIds: Type.Optional(Type.Array(Type.Number(), { description: "角色ID列表" })),
    /**
     * 改密推荐位。true = 该账号的密码仍是老系统格式（或由管理员重置后待确认），
     * 前端应展示"建议立即修改密码"提示。用户主动改密成功后由后端清 0。
     */
    passwordChangeRecommended: Type.Optional(
      Type.Boolean({ description: "是否建议该用户修改密码" })
    ),
  },
  { $id: "sysUser" }
);

//获取用户详情
export type SysUserResp = Static<typeof SysUserSchema>;

// 创建用户请求 Schema
// 注意：Type.Optional 字段不允许设置 default。Fastify Ajv 默认开启 useDefaults:true，
// 若保留 default，UpdateXxxReq = Type.Partial(CreateXxxReq) 会让 Fastify 在请求体缺字段时
// 自动注入默认值，从而导致 update 接口把数据库中已存在的字段重置为 schema 默认值。
// 这里统一去掉 default，由 Service 层（createUser 的 toCreateUserInput）负责设置缺省值。
export const CreateUserReqSchema = Type.Object(
  {
    username: Type.Optional(Type.String({
      description: "用户名",
      maxLength: 50,
    })),
    email: Type.Optional(Type.String({ format: "email", description: "邮箱" })),
    password: Type.String({
      description: "用户密码",
      minLength: 6,
      maxLength: 50,
      pattern: "^(?=.*[a-zA-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{6,}$"
    }),
    phone: Type.String({
      description: "手机号",
      minLength: 1,
      maxLength: 20
    }),
    realName: Type.Optional(Type.String({
      description: "真实姓名",
      maxLength: 50,
    })),
    nickname: Type.Optional(Type.String({
      description: "昵称",
      maxLength: 50,
    })),
    avatar: Type.Optional(Type.String({ description: "头像URL" })),
    gender: Type.Optional(
      Type.String({
        enum: ["0", "1", "2"],
        description: "性别（0-未知，1-男，2-女）",
      })
    ),
    birthDate: Type.Optional(
      Type.Union([
        Type.String({ format: "date", description: "出生日期" }),
        Type.Literal('')
      ])
    ),
    status: Type.Optional(
      Type.String({
        enum: ["0", "1", "2"],
        description: "状态（0-禁用，1-启用，2-锁定）",
      })
    ),
    deptIds: Type.Optional(Type.Array(Type.Number(), { description: "部门ID列表" })),
    roleIds: Type.Optional(Type.Array(Type.Number(), { description: "角色ID列表" })),
    // **内部控制字段**（Task 5）：把这次创建关联到某一份 AI 草稿。它不是表单字段，
    // 不会进入用户数据，也不会出现在 create-form 的字段集里（user-creation-form.service
    // 用 NON_FORM_FIELDS 显式剔除）。带上它而系统里没有注册参与者时，创建会被拒绝，
    // 绝不静默降级成一次普通的创建。
    draftSubmission: Type.Optional(Type.Object(
      {
        draftId: Type.String({ description: "草稿 ID", minLength: 1, maxLength: 64 }),
        draftVersion: Type.Integer({ description: "草稿版本（乐观并发）", minimum: 1 }),
      },
      { additionalProperties: false, description: "AI 草稿提交关联；仅由原生表单的提交动作携带" }
    )),
  },
  { $id: "createUserReq" }
);

/** 更新用户请求 Schema（全部字段可选，至少提供一个字段）。 */
const UpdateUserReqSchema = Type.Partial(
  // `draftSubmission` 只属于创建：修改用户没有「消费一份草稿」这回事，
  // 让它跟着 Type.Partial 进更新接口只会多一条可以把修改伪装成草稿提交的入口。
  Type.Omit(CreateUserReqSchema, ["draftSubmission"]),
  {
    $id: "updateUserReq",
    minProperties: 1,
  }
);

// 用户列表查询参数 Schema
export const UserListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({
        description: "搜索关键词（用户名、邮箱、真实姓名、昵称）",
      })
    ),
    status: Type.Optional(
      Type.String({
        enum: ["0", "1", "2"],
        description: "用户状态（0-禁用，1-启用，2-锁定）",
      })
    ),
    startTime: Type.Optional(
      Type.String({
        format: "date-time",
        description: "开始时间",
      })
    ),
    endTime: Type.Optional(
      Type.String({
        format: "date-time",
        description: "结束时间",
      })
    ),
    sortBy: Type.Optional(
      Type.String({
        enum: ["createdAt", "updatedAt", "lastLoginTime", "loginCount"],
        default: "createdAt",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(
      Type.String({
        enum: ["asc", "desc"],
        default: "desc",
        description: "排序方向",
      })
    ),
  },
  { $id: "userListQuery" }
);

export type UserListQuery = Static<typeof UserListQuerySchema>;
export type CreateUserReq = Static<typeof CreateUserReqSchema>;
export type UpdateUserReq = Static<typeof UpdateUserReqSchema>;

/** 草稿提交关联。定义与 `CreateUserReqSchema.draftSubmission` 一一对应。 */
export type DraftSubmissionReq = NonNullable<CreateUserReq["draftSubmission"]>;

/** 创建请求里**真正参与落库**的部分 —— 已经剥掉 `draftSubmission`。 */
export type CreateUserFieldsReq = Omit<CreateUserReq, "draftSubmission">;

/**
 * 助手可写的用户字段白名单 —— 与真实后台表单同源。
 *
 * 派生自 `CreateUserReqSchema`（先 Omit 掉 `password` 与后续的 `draftSubmission`），
 * 再按 `packages/core/system-admin` 的 `UserForm` 实际字段取交集：
 *
 *   username / deptIds / phone / email / realName / nickname / gender / status /
 *   roleIds / birthDate
 *
 * 两条刻意的取舍：
 *   - **不暴露 `password`**：密码只留在受保护的表单控件与本次提交请求里，
 *     不进入草稿、工具参数、模型上下文或审计正文。
 *   - **不暴露 `avatar`**：`avatar` 今天确实可写，但 UserForm 里没有它。
 *     「可写」不等于「表单里有」，把不在表单里的字段开放给助手只会凭空
 *     多出一条用户无法在界面上确认或撤销的写入路径。
 *
 * 手机号沿用真实 schema 的 1-20 位契约，不在 AI 路径单独加国家/地区假设。
 */
export const USER_CREATE_DRAFT_FIELD_KEYS = [
  "username",
  "email",
  "phone",
  "realName",
  "nickname",
  "gender",
  "birthDate",
  "status",
  "deptIds",
  "roleIds",
] as const;

const UserCreateDraftBaseSchema = Type.Omit(CreateUserReqSchema, [
  "password",
  "draftSubmission",
]);

export const UserCreateDraftFieldsSchema = Type.Object(
  Object.fromEntries(
    USER_CREATE_DRAFT_FIELD_KEYS.map((key) => [key, UserCreateDraftBaseSchema.properties[key]]),
  ) as Pick<
    typeof UserCreateDraftBaseSchema.properties,
    (typeof USER_CREATE_DRAFT_FIELD_KEYS)[number]
  >,
  { $id: "userCreateDraftFields", additionalProperties: false },
);

/** 草稿逐轮补齐，因此全部字段可选；提交前仍由真实 create schema 校验必填项。 */
export const UserCreateDraftPartialSchema = Type.Partial(UserCreateDraftFieldsSchema, {
  $id: "userCreateDraftPartial",
  additionalProperties: false,
});

export type UserCreateDraftFields = Static<typeof UserCreateDraftFieldsSchema>;
export const UserUpdatePrefillFieldsSchema = Type.Pick(UpdateUserReqSchema, [...USER_CREATE_DRAFT_FIELD_KEYS], {
  $id: 'userUpdatePrefillFields', additionalProperties: false, minProperties: 0,
});
/** 候选查询参数（与 `UserCreateOptionsQuerySchema` 同源）。 */
export type UserCreateOptionsQuery = Static<typeof UserCreateOptionsQuerySchema>;
export type UserCreateDraftPartial = Static<typeof UserCreateDraftPartialSchema>;

// ---------------------------------------------------------------------------
// 新增用户表单的只读元数据（原生表单与 AI 助手共用）
// ---------------------------------------------------------------------------

/** 表单字段元数据。`selector` 只是既有候选来源的标识，不是可执行渲染代码。 */
const UserCreateFormFieldSchema = Type.Object(
  {
    name: Type.String({ description: "字段名", example: "phone" }),
    label: Type.String({ description: "字段标签", example: "手机号" }),
    required: Type.Boolean({ description: "是否必填（来自真实 create schema）" }),
    sensitive: Type.Boolean({ description: "是否敏感字段（只能由用户在表单里输入）" }),
    selector: Type.String({
      description: "选择器标识：enum/date/email/password/text/deptTree/roleOptions",
      example: "text",
    }),
    constraints: Type.Object({}, {
      additionalProperties: true,
      description: "来自真实 schema 的约束（minLength/maxLength/pattern/format/enum/...）",
    }),
  },
  { additionalProperties: false }
);

/** 真实表单里有、但对话不应收集的字段。 */
const UserCreateFormMissingFieldSchema = Type.Object(
  {
    name: Type.String({ description: "字段名", example: "password" }),
    label: Type.String({ description: "字段标签", example: "初始密码" }),
    required: Type.Boolean(),
    sensitive: Type.Boolean(),
    mustCompleteInForm: Type.Literal(true, { description: "必须由用户在表单中完成" }),
  },
  { additionalProperties: false }
);

const UserCreateFormRespSchema = successResponse({
  data: Type.Object(
    {
      schemaVersion: Type.Integer({ description: "表单契约版本，版本不符时必须重新读取" }),
      fields: Type.Array(UserCreateFormFieldSchema, { description: "真实表单字段定义" }),
      defaults: Type.Object({}, { additionalProperties: true, description: "真实 schema 声明的默认值" }),
      editableFields: Type.Array(Type.String(), { description: "对话可写入的字段白名单" }),
      missingFields: Type.Array(UserCreateFormMissingFieldSchema, { description: "需要在表单中完成的字段" }),
    },
    { additionalProperties: false }
  ),
  $id: "userCreateFormResp",
});

/**
 * 候选查询参数。
 *
 * `additionalProperties: false` 是有意的：伪造的「可编辑字段」「要哪些角色」之类的
 * 声明会被 400 直接拒绝，而不是被静默忽略后让人以为生效了。
 */
export const UserCreateOptionsQuerySchema = Type.Object(
  {
    keyword: Type.Optional(Type.String({ description: "角色名称关键词" })),
    deptIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }), { description: "候选归属部门（角色按此重算）" })),
    page: Type.Optional(Type.Integer({ minimum: 1, description: "页码，从 1 开始" })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: "每页条数" })),
  },
  { $id: "userCreateOptionsQuery", additionalProperties: false }
);

const UserCreateRoleOptionSchema = Type.Object(
  {
    id: Type.Integer({ description: "角色 ID（名字可重名，身份一律以 ID 为准" }),
    name: Type.String({ description: "角色名称" }),
  },
  { additionalProperties: false }
);

const UserCreateOptionsRespSchema = successResponse({
  data: Type.Object(
    {
      // 刻意不 $ref `deptTreeNode`：用户 Schema 模块不必依赖部门模块的注册顺序，
      // 而节点形状就是既有部门树节点的形状（id/name/parentId/.../children），不另造树模型。
      departments: Type.Array(Type.Object({}, { additionalProperties: true }), {
        description: "按授权范围过滤后的部门树（沿用原有部门树结构）",
      }),
      roles: Type.Array(UserCreateRoleOptionSchema, { description: "本次可授予的角色候选" }),
      total: Type.Integer({ description: "过滤后的候选总数" }),
      page: Type.Integer(),
      pageSize: Type.Integer(),
      creatable: Type.Boolean({ description: "当前操作者在 system:user:create 上能否建号" }),
    },
    { additionalProperties: false }
  ),
  $id: "userCreateOptionsResp",
  message: "获取成功",
});

// 获取用户列表
const UserListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysUser")),
  $id: "userListResp",
  includePagination: true,
});

// 获取用户详情
const UserDetailRespSchema = successResponse({
  data: Type.Ref("sysUser"),
  $id: "userDetailResp",
});

// 删除用户响应
const UserDeleteRespSchema = successResponse({
  data: Type.Object({
    id: Type.Number({ description: "用户ID" }),
    deleted: Type.Boolean({ description: "是否已删除", example: true })
  }),
  $id: "userDeleteResp",
  message: "删除成功"
});

const registerUser = (fastify: FastifyInstance) => {
  fastify.addSchema(SysUserSchema);
  fastify.addSchema(UserListQuerySchema);
  fastify.addSchema(UserListRespSchema);
  fastify.addSchema(CreateUserReqSchema);
  fastify.addSchema(UpdateUserReqSchema);
  fastify.addSchema(UserDetailRespSchema);
  fastify.addSchema(UserDeleteRespSchema);
  fastify.addSchema(UserCreateOptionsQuerySchema);
  fastify.addSchema(UserCreateFormRespSchema);
  fastify.addSchema(UserCreateOptionsRespSchema);
};

export default registerUser;
