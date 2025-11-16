/**
 * 岗位业务逻辑服务
 */

import { SysPostModel } from "../models/sys-post.model.js";
import { SavePostReq, PostListQuery, SysPostResp, UpdatePostReq } from "../schemas/post.js";
import { BusinessError } from "../exceptions/business-error.js";
import { PostErrorCode } from "../constants/business-codes/post.js";

export class PostService {
  /** 获取岗位列表 */
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

  /** 获取岗位详情 */
  static async getPostById(id: number) {
    return await SysPostModel.getPostById(id);
  }

  /** 创建岗位（校验名称/编码唯一） */
  static async createPost(req: SavePostReq): Promise<SysPostResp> {
    await this.ensureUnique(req.name);
    return await SysPostModel.createPost(req);
  }

  /** 更新岗位（校验名称唯一） */
  static async updatePost(id: number, req: UpdatePostReq): Promise<SysPostResp> {
    const existing = await SysPostModel.getPostById(id);
    if (!existing) {
      throw new BusinessError(PostErrorCode.POST_NOT_FOUND, "岗位不存在");
    }

    if (req.name) {
      await this.ensureUnique(req.name, id);
    }

    return await SysPostModel.updatePost(id, req);
  }

  /** 删除岗位（软删除） */
  static async deletePost(id: number): Promise<{ id: number }> {
    const existing = await SysPostModel.getPostById(id);
    if (!existing) {
      throw new BusinessError(PostErrorCode.POST_NOT_FOUND, "岗位不存在");
    }

    const res = await SysPostModel.deletePost(id);
    if (!res) {
      throw new BusinessError(PostErrorCode.POST_NOT_FOUND, "岗位不存在或已删除");
    }
    return res;
  }

  /** 校验名称唯一性（排除自身） */
  private static async ensureUnique(name?: string, excludeId?: number): Promise<void> {
    if (!name) return;
    const dup = await SysPostModel.getPostByName(name);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(PostErrorCode.POST_ALREADY_EXISTS, "岗位名称已存在");
    }
  }
}