import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../constants/business-codes/validation.js";
import { PostErrorCode } from "../../../../../constants/business-codes/post.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";
import { PostListQuery, SavePostReq, UpdatePostReq } from "../../../../../schemas/post.js";
import { PostService } from "../../../../../services/post.service.js";

const adminPosts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/admin/posts - 获取岗位列表
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取岗位列表",
        description: "分页获取系统岗位列表，支持关键词搜索和状态筛选",
        operationId: "getPostList",
        tags: ["sysPosts"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "postListQuery#" },
        response: {
          200: { $ref: "postListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: PostListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await PostService.getPostList(request.query);
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        "获取岗位列表成功"
      );
    }
  );

  // GET /api/v1/admin/posts/{id} - 获取岗位详情
  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取岗位详情",
        description: "根据岗位ID获取岗位详情",
        operationId: "getPostDetail",
        tags: ["sysPosts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "岗位ID" }) }),
        response: { 200: { $ref: "postDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const postId = parseInt(request.params.id);
      if (isNaN(postId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "岗位ID不能为空");
      }
      const post = await PostService.getPostById(postId);
      if (!post) {
        throw new BusinessError(PostErrorCode.POST_NOT_FOUND, "岗位不存在");
      }
      return ResponseUtil.success(reply, post, "获取岗位详情成功");
    }
  );

  // POST /api/v1/admin/posts - 创建岗位
  fastify.post(
    "/",
    {
      schema: {
        summary: "创建岗位",
        description: "创建一个新的岗位",
        operationId: "createPost",
        tags: ["sysPosts"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "savePostReq#" },
        response: { 200: { $ref: "postDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Body: SavePostReq }>,
      reply: FastifyReply
    ) => {
      const post = await PostService.createPost(request.body);
      return ResponseUtil.success(reply, post, "创建岗位成功");
    }
  );

  // PUT /api/v1/admin/posts/{id} - 更新岗位
  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新岗位",
        description: "根据岗位ID更新岗位信息",
        operationId: "updatePost",
        tags: ["sysPosts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "岗位ID" }) }),
        body: { $ref: "updatePostReq#" },
        response: { 200: { $ref: "postDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdatePostReq }>,
      reply: FastifyReply
    ) => {
      const postId = parseInt(request.params.id);
      if (isNaN(postId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "岗位ID不能为空");
      }
      const post = await PostService.updatePost(postId, request.body);
      return ResponseUtil.success(reply, post, "更新岗位成功");
    }
  );

  // DELETE /api/v1/admin/posts/{id} - 删除岗位（软删除）
  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除岗位",
        description: "根据岗位ID进行软删除",
        operationId: "deletePost",
        tags: ["sysPosts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "岗位ID" }) }),
        response: { 200: { $ref: "postDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const postId = parseInt(request.params.id);
      if (isNaN(postId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "岗位ID不能为空");
      }
      const result = await PostService.deletePost(postId);
      return ResponseUtil.success(reply, result, "删除岗位成功");
    }
  );
};

export default adminPosts;