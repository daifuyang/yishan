import { SysPostModel } from "../models/sys-post.model.js";
import { PostErrorCode } from "../constants/business-codes/post.js";
import { ValidationErrorCode } from "../constants/business-codes/validation.js";
import { BusinessError } from "../exceptions/business-error.js";
import { PostListQuery, SavePostReq, SysPostResp, UpdatePostReq } from "../schemas/post.js";

export class PostService {
  static async getPostList(query: PostListQuery) {
    const list = await SysPostModel.getPostList(query);
    const total = await SysPostModel.getPostTotal(query);
    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getPostById(id: number): Promise<SysPostResp | null> {
    return await SysPostModel.getPostById(id);
  }

  static async createPost(req: SavePostReq): Promise<SysPostResp> {
    const existingPost = await SysPostModel.getPostByName(req.name);
    if (existingPost) {
      throw new BusinessError(PostErrorCode.POST_ALREADY_EXISTS, "岗位名称已存在");
    }
    return await SysPostModel.createPost(req);
  }

  static async updatePost(id: number, req: UpdatePostReq): Promise<SysPostResp> {
    const existingPost = await SysPostModel.getPostById(id);
    if (!existingPost) {
      throw new BusinessError(PostErrorCode.POST_NOT_FOUND, "岗位不存在");
    }

    if (req.name && req.name !== existingPost.name) {
      const duplicatePost = await SysPostModel.getPostByName(req.name);
      if (duplicatePost && duplicatePost.id !== id) {
        throw new BusinessError(PostErrorCode.POST_ALREADY_EXISTS, "岗位名称已存在");
      }
    }

    return await SysPostModel.updatePost(id, req);
  }

  static async deletePost(id: number): Promise<{ id: number }> {
    const existingPost = await SysPostModel.getPostById(id);
    if (!existingPost) {
      throw new BusinessError(PostErrorCode.POST_NOT_FOUND, "岗位不存在");
    }

    if (existingPost.name === "超级管理员") {
      throw new BusinessError(PostErrorCode.POST_DELETE_FORBIDDEN, "系统默认岗位不允许删除");
    }

    const result = await SysPostModel.deletePost(id);
    if (!result) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "删除失败");
    }

    return result;
  }
}
