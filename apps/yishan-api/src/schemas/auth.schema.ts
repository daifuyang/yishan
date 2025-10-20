export const sysUserSchema = {
  $id: "sysUser",
  type: "object",
  properties: {
    id: { type: "number", description: "用户ID" },
    username: { type: "string", description: "用户名" },
    email: { type: "string", description: "用户邮箱" },
    phone: { type: "string", description: "手机号" },
    realName: { type: "string", description: "真实姓名" },
    avatar: { type: "string", description: "头像URL" },
    gender: {
      type: "number",
      enum: [0, 1, 2],
      description: "性别：0-未知，1-男，2-女",
    },
    birthDate: { type: "string", format: "date", description: "出生日期" },
    status: {
      type: "number",
      enum: [0, 1, 2],
      description: "状态：0-禁用，1-启用，2-锁定",
    },
    lastLoginTime: {
      type: "string",
      format: "date-time",
      description: "最后登录时间",
    },
    loginCount: { type: "number", description: "登录次数" },
    createdAt: { type: "string", format: "date-time", description: "创建时间" },
    updatedAt: { type: "string", format: "date-time", description: "更新时间" },
  },
};

export const sysUserTokenResponseSchema = {
  $id: "sysUserTokenResponse",
  type: "object",
  properties: {
    accessToken: { type: "string", description: "JWT访问令牌" },
    refreshToken: { type: "string", description: "JWT刷新令牌" },
    accessTokenExpiresIn: {
      type: "number",
      description: "访问令牌过期时间（秒）",
      example: 900,
    },
    refreshTokenExpiresIn: {
      type: "number",
      description: "刷新令牌过期时间（秒）",
      example: 604800,
    },
    tokenType: { type: "string", example: "Bearer", description: "令牌类型" },
  },
  required: [
    "accessToken",
    "refreshToken",
    "accessTokenExpiresIn",
    "refreshTokenExpiresIn",
    "tokenType",
  ],
};

export const sysUserLoginRequestSchema = {
  $id: "sysUserLoginRequest",
  type: "object",
  required: ["password"],
  properties: {
    username: { type: "string", description: "用户名" },
    email: { type: "string", format: "email", description: "用户邮箱" },
    password: { type: "string", minLength: 6, description: "用户密码" },
  },
  anyOf: [
    { required: ["username", "password"] },
    { required: ["email", "password"] },
  ],
};

export const sysUserRefreshTokenRequestSchema = {
  $id: "sysUserRefreshTokenRequest",
  type: "object",
  required: ["refresh_token"],
  properties: {
    refreshToken: { type: "string", description: "刷新令牌" },
  },
};

export const baseResponseSchema = {
  $id: "baseResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 200 },
    message: { type: "string", example: "操作成功" },
    success: { type: "boolean", example: true, description: "请求是否成功" },
  },
};

export const errorResponseSchema = {
  $id: "errorResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 400 },
    message: { type: "string", example: "操作失败" },
    success: { type: "boolean", example: false, description: "请求是否成功" },
    data: { type: "null", example: null, description: "错误响应数据为空" },
    timestamp: { type: "string", format: "date-time" },
    error: {
      type: "object",
      properties: {
        type: { type: "string", example: "ValidationError", description: "错误类型" },
        detail: { type: "string", example: "参数验证失败", description: "错误详情" },
        errorId: { type: "string", example: "uuid", description: "错误ID" },
        validation: {
          type: "object",
          additionalProperties: {
            type: "array",
            items: { type: "string" }
          },
          description: "验证错误详情"
        }
      }
    }
  },
};

export const successResponseSchema = {
  $id: "successResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 20000 },
    message: { type: "string", example: "操作成功" },
    success: { type: "boolean", example: true, description: "请求是否成功" },
    data: { description: "响应数据" }
  }
};

export const unauthorizedResponseSchema = {
  $id: "unauthorizedResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 401 },
    message: { type: "string", example: "未授权访问" },
    success: { type: "boolean", example: false, description: "请求是否成功" },
    data: { type: "null", example: null, description: "错误响应数据为空" },
    timestamp: { type: "string", format: "date-time" },
    error: {
      type: "object",
      properties: {
        type: { type: "string", example: "UnauthorizedError", description: "错误类型" },
        detail: { type: "string", example: "未授权访问", description: "错误详情" },
        errorId: { type: "string", example: "uuid", description: "错误ID" }
      }
    }
  },
};

export const notFoundResponseSchema = {
  $id: "notFoundResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 404 },
    message: { type: "string", example: "资源不存在" },
    success: { type: "boolean", example: false, description: "请求是否成功" },
    data: { type: "null", example: null, description: "错误响应数据为空" },
    timestamp: { type: "string", format: "date-time" },
    error: {
      type: "object",
      properties: {
        type: { type: "string", example: "NotFoundError", description: "错误类型" },
        detail: { type: "string", example: "请求的资源不存在", description: "错误详情" },
        errorId: { type: "string", example: "uuid", description: "错误ID" }
      }
    }
  },
};

export const conflictResponseSchema = {
  $id: "conflictResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 409 },
    message: { type: "string", example: "资源冲突" },
    success: { type: "boolean", example: false, description: "请求是否成功" },
    data: { type: "null", example: null, description: "错误响应数据为空" },
    timestamp: { type: "string", format: "date-time" },
    error: {
      type: "object",
      properties: {
        type: { type: "string", example: "ConflictError", description: "错误类型" },
        detail: { type: "string", example: "资源已存在或存在冲突", description: "错误详情" },
        errorId: { type: "string", example: "uuid", description: "错误ID" }
      }
    }
  },
};

export const forbiddenResponseSchema = {
  $id: "forbiddenResponse",
  type: "object",
  properties: {
    code: { type: "number", example: 403 },
    message: { type: "string", example: "禁止访问" },
    success: { type: "boolean", example: false, description: "请求是否成功" },
    data: { type: "null", example: null, description: "错误响应数据为空" },
    timestamp: { type: "string", format: "date-time" },
    error: {
      type: "object",
      properties: {
        type: { type: "string", example: "ForbiddenError", description: "错误类型" },
        detail: { type: "string", example: "没有权限访问该资源", description: "错误详情" },
        errorId: { type: "string", example: "uuid", description: "错误ID" }
      }
    }
  },
};
