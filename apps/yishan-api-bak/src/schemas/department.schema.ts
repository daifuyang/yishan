// 部门管理相关的 schema 定义
export const sysDepartmentSchema = {
  $id: "sysDepartment",
  type: "object",
  properties: {
    id: { type: "number", description: "部门ID" },
    parentId: { type: ["number", "null"], description: "父部门ID，0表示顶级部门" },
    deptName: { type: "string", description: "部门名称" },
    deptDesc: { type: "string", description: "部门描述" },
    deptType: { type: "number", enum: [1, 2, 3], description: "部门类型：1-公司，2-部门，3-小组" },
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", description: "排序顺序" },
    leaderId: { type: "number", description: "部门负责人ID" },
    leaderName: { type: "string", description: "部门负责人姓名" },
    phone: { type: "string", description: "部门电话" },
    email: { type: "string", description: "部门邮箱" },
    address: { type: "string", description: "部门地址" },
    createdAt: { type: "string", format: "date-time", description: "创建时间" },
    updatedAt: { type: "string", format: "date-time", description: "更新时间" },
    creatorId: { type: "number", description: "创建人ID" },
    updaterId: { type: "number", description: "更新人ID" },
    deletedAt: { type: "string", format: "date-time", description: "删除时间" },
    children: {
      type: "array",
      items: { $ref: "sysDepartment#" },
      description: "子部门列表"
    }
  }
};

export const sysDepartmentCreateRequestSchema = {
  $id: "sysDepartmentCreateRequest",
  type: "object",
  required: ["deptName", "parentId", "deptType"],
  properties: {
    parentId: { type: ["number", "null"], description: "父部门ID，0表示顶级部门" },
    deptName: { type: "string", minLength: 1, maxLength: 50, description: "部门名称" },
    deptDesc: { type: "string", maxLength: 200, description: "部门描述" },
    deptType: { type: "number", enum: [1, 2, 3], description: "部门类型：1-公司，2-部门，3-小组" },
    status: { type: "number", enum: [0, 1], default: 1, description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", minimum: 0, description: "排序顺序" },
    leaderId: { type: "number", description: "部门负责人ID" },
    phone: { type: "string", maxLength: 20, description: "部门电话" },
    email: { type: "string", format: "email", maxLength: 100, description: "部门邮箱" },
    address: { type: "string", maxLength: 200, description: "部门地址" }
  },
  additionalProperties: false
};

export const sysDepartmentQueryRequestSchema = {
  $id: "sysDepartmentQueryRequest",
  type: "object",
  properties: {
    page: { type: "number", minimum: 1, default: 1, description: "页码" },
    pageSize: { type: "number", minimum: 1, maximum: 100, default: 10, description: "每页数量" },
    deptName: { type: "string", description: "部门名称（模糊查询）" },
    parentId: { type: ["number", "null"], description: "父部门ID" },
    deptType: { type: "number", enum: [1, 2, 3], description: "部门类型" },
    status: { type: "number", enum: [0, 1], description: "状态" },
    leaderId: { type: "number", description: "部门负责人ID" }
  },
  additionalProperties: false
};

export const sysDepartmentListResponseSchema = {
  $id: "sysDepartmentListResponse",
  type: "object",
  properties: {
    list: {
      type: "array",
      items: { $ref: "sysDepartment#" }
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "number", description: "当前页码" },
        pageSize: { type: "number", description: "每页条数" },
        total: { type: "number", description: "总记录数" },
        totalPages: { type: "number", description: "总页数" }
      }
    }
  }
};

export const sysDepartmentUpdateRequestSchema = {
  $id: "sysDepartmentUpdateRequest",
  type: "object",
  properties: {
    deptName: { type: "string", minLength: 1, maxLength: 50, description: "部门名称" },
    deptDesc: { type: "string", maxLength: 200, description: "部门描述" },
    deptType: { type: "number", enum: [1, 2, 3], description: "部门类型：1-公司，2-部门，3-小组" },
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" },
    sortOrder: { type: "number", minimum: 0, description: "排序顺序" },
    leaderId: { type: "number", description: "部门负责人ID" },
    phone: { type: "string", maxLength: 20, description: "部门电话" },
    email: { type: "string", format: "email", maxLength: 100, description: "部门邮箱" },
    address: { type: "string", maxLength: 200, description: "部门地址" }
  },
  additionalProperties: false
};

export const sysDepartmentStatusUpdateRequestSchema = {
  $id: "sysDepartmentStatusUpdateRequest",
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "number", enum: [0, 1], description: "状态：0-禁用，1-启用" }
  }
};

export const sysDepartmentBatchDeleteRequestSchema = {
  $id: "sysDepartmentBatchDeleteRequest",
  type: "object",
  required: ["deptIds"],
  properties: {
    deptIds: { 
      type: "array", 
      items: { type: "number" },
      minItems: 1,
      description: "部门ID列表" 
    }
  }
};

export const sysDepartmentTreeResponseSchema = {
  $id: "sysDepartmentTreeResponse",
  type: "object",
  properties: {
    tree: {
      type: "array",
      items: { $ref: "sysDepartment#" },
      description: "部门树结构"
    }
  }
};

export const sysDepartmentMoveRequestSchema = { 
  $id: "sysDepartmentMoveRequest",
  type: "object",
  required: ["targetParentId"],
  properties: {
    targetParentId: { 
      type: ["number", "null"], 
      description: "目标父部门ID，null表示移动到顶级" 
    },
    sortOrder: { 
      type: "number", 
      minimum: 0, 
      description: "新的排序顺序" 
    }
  }
};

export const sysDepartmentIdParamSchema = {
  $id: "sysDepartmentIdParam",
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "number", description: "部门ID" }
  }
};

export const sysDepartmentMemberQueryRequestSchema = {
  $id: "sysDepartmentMemberQueryRequest",
  type: "object",
  properties: {
    page: { type: "number", minimum: 1, default: 1, description: "页码" },
    pageSize: { type: "number", minimum: 1, maximum: 100, default: 10, description: "每页数量" },
    userName: { type: "string", description: "用户名（模糊查询）" },
    realName: { type: "string", description: "真实姓名（模糊查询）" },
    status: { type: "number", enum: [0, 1], description: "状态" }
  },
  additionalProperties: false
};

export const sysDepartmentMemberListResponseSchema = {
  $id: "sysDepartmentMemberListResponse",
  type: "object",
  properties: {
    list: {
      type: "array",
      items: { $ref: "sysUser#" }
    },
    pagination: {
      type: "object",
      properties: {
        page: { type: "number", description: "当前页码" },
        pageSize: { type: "number", description: "每页条数" },
        total: { type: "number", description: "总记录数" },
        totalPages: { type: "number", description: "总页数" }
      }
    }
  }
};

export const sysDepartmentBatchRequestSchema = {
  $id: "sysDepartmentBatchRequest",
  type: "object",
  required: ["deptIds"],
  properties: {
    deptIds: { 
      type: "array", 
      items: { type: "number" },
      minItems: 1,
      description: "部门ID列表" 
    },
    ids: { 
      type: "array", 
      items: { type: "number" },
      minItems: 1,
      description: "部门ID列表（兼容字段）" 
    }
  }
};

export const sysDepartmentBatchResponseSchema = {
  $id: "sysDepartmentBatchResponse",
  type: "object",
  properties: {
    successCount: { type: "number", description: "成功处理的数量" },
    failureCount: { type: "number", description: "失败处理的数量" },
    details: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number", description: "部门ID" },
          success: { type: "boolean", description: "是否成功" },
          message: { type: "string", description: "处理结果消息" }
        }
      }
    }
  }
};