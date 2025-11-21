import { Static, TSchema, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";

interface SuccessResponseParams<T extends TSchema> {
  data: T;
  $id?: string | undefined;
  message?: string;
  code?: number;
  includePagination?: boolean;
}

// 成功响应 Schema 工厂函数
export const successResponse = <T extends TSchema>(
  params: SuccessResponseParams<T>
) => {
  const {
    data,
    $id,
    message = "操作成功",
    code = 10000,
    includePagination = false,
  } = params;

  const properties: any = {
    code: Type.Number({ example: code }),
    message: Type.String({ example: message }),
    success: Type.Boolean({ example: true }),
    data,
    timestamp: Type.String({ format: "date-time" }),
  };

  // 只在需要时添加分页字段
  if (includePagination) {
    properties.pagination = Type.Ref("paginationResponse");
  }

  return Type.Object(properties, { $id });
};

// 通用分页
const PaginationSchema = Type.Object(
  {
    page: Type.Number({ example: 1 }),
    pageSize: Type.Number({ example: 10 }),
    total: Type.Number({ example: 100 }),
    totalPages: Type.Number({ example: 10 }),
  },
  {
    $id: "paginationResponse",
  }
);

// 通用分页请求参数
export const PaginationQuerySchema = Type.Object(
  {
    page: Type.Optional(
      Type.Integer({
        minimum: 1,
        default: 1,
        description: "页码",
      })
    ),
    pageSize: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 10,
        description: "每页数量",
      })
    ),
  },
  { $id: "paginationQuery" }
);

export type PaginationQuery = Static<typeof PaginationQuerySchema>;

const registerCommon = (fastify: FastifyInstance) => {
  fastify.addSchema(PaginationSchema);
};

export default registerCommon;
