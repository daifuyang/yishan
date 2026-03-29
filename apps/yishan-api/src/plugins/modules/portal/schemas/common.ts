import { Static, TSchema, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";

interface SuccessResponseParams<T extends TSchema> {
  data: T;
  $id?: string | undefined;
  message?: string;
  code?: number;
  includePagination?: boolean;
}

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

  if (includePagination) {
    properties.pagination = Type.Ref("paginationResponse");
  }

  return Type.Object(properties, { $id });
};

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
