import { PortalArticleModel } from "../models/portal-article.model.js";
import { PortalCategoryModel } from "../models/portal-category.model.js";
import { ArticleListQuery, CreateArticleReq, PortalArticleResp, UpdateArticleReq, CategoryListQuery, PortalCategoryResp, SaveCategoryReq, UpdateCategoryReq } from "../schemas/article.js";
import { BusinessError } from "../exceptions/business-error.js";
import { ArticleErrorCode, CategoryErrorCode } from "../constants/business-codes/article.js";

export class ArticleService {
  static async getArticleList(query: ArticleListQuery) {
    const list = await PortalArticleModel.getArticleList(query);
    const total = await PortalArticleModel.getArticleTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getArticleById(id: number): Promise<PortalArticleResp> {
    const article = await PortalArticleModel.getArticleById(id);
    if (!article) throw new BusinessError(ArticleErrorCode.ARTICLE_NOT_FOUND, "文章不存在");
    return article;
  }

  static async createArticle(req: CreateArticleReq, userId: number): Promise<PortalArticleResp> {
    // 唯一性校验（slug）
    if (req.slug) {
      const existed = await PortalArticleModel.getArticleBySlug(req.slug);
      if (existed) throw new BusinessError(ArticleErrorCode.ARTICLE_ALREADY_EXISTS, "文章Slug已存在");
    }
    return await PortalArticleModel.createArticle(req, userId);
  }

  static async updateArticle(id: number, req: UpdateArticleReq, userId: number): Promise<PortalArticleResp> {
    const existed = await PortalArticleModel.getArticleById(id);
    if (!existed) throw new BusinessError(ArticleErrorCode.ARTICLE_NOT_FOUND, "文章不存在");
    if (req.slug) {
      const dupe = await PortalArticleModel.getArticleBySlug(req.slug);
      if (dupe && dupe.id !== id) throw new BusinessError(ArticleErrorCode.ARTICLE_ALREADY_EXISTS, "文章Slug已存在");
    }
    return await PortalArticleModel.updateArticle(id, req, userId);
  }

  static async deleteArticle(id: number) {
    const result = await PortalArticleModel.deleteArticle(id);
    if (!result) throw new BusinessError(ArticleErrorCode.ARTICLE_NOT_FOUND, "文章不存在");
    return result;
  }

  static async publishArticle(id: number, userId: number) {
    const result = await PortalArticleModel.publishArticle(id, userId);
    if (!result) throw new BusinessError(ArticleErrorCode.ARTICLE_NOT_FOUND, "文章不存在");
    return result;
  }
}

export class CategoryService {
  static async getCategoryList(query: CategoryListQuery) {
    const list = await PortalCategoryModel.getCategoryList(query);
    const total = await PortalCategoryModel.getCategoryTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getCategoryById(id: number): Promise<PortalCategoryResp> {
    const c = await PortalCategoryModel.getCategoryById(id);
    if (!c) throw new BusinessError(CategoryErrorCode.CATEGORY_NOT_FOUND, "分类不存在");
    return c;
  }

  static async createCategory(req: SaveCategoryReq, userId: number): Promise<PortalCategoryResp> {
    const dupe = await PortalCategoryModel.getCategoryByName(req.name, req.parentId ?? undefined);
    if (dupe) throw new BusinessError(CategoryErrorCode.CATEGORY_ALREADY_EXISTS, "分类已存在");
    return await PortalCategoryModel.createCategory(req, userId);
  }

  static async updateCategory(id: number, req: UpdateCategoryReq, userId: number): Promise<PortalCategoryResp> {
    const existed = await PortalCategoryModel.getCategoryById(id);
    if (!existed) throw new BusinessError(CategoryErrorCode.CATEGORY_NOT_FOUND, "分类不存在");
    if (req.name) {
      const dupe = await PortalCategoryModel.getCategoryByName(req.name, req.parentId ?? existed.parentId ?? undefined);
      if (dupe && dupe.id !== id) throw new BusinessError(CategoryErrorCode.CATEGORY_ALREADY_EXISTS, "分类已存在");
    }
    return await PortalCategoryModel.updateCategory(id, req, userId);
  }

  static async deleteCategory(id: number) {
    const result = await PortalCategoryModel.deleteCategory(id);
    if (!result) throw new BusinessError(CategoryErrorCode.CATEGORY_NOT_FOUND, "分类不存在");
    return result;
  }
}
