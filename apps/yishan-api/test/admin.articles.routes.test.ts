import Fastify from "fastify";
import adminArticlesPlugin from "../src/routes/api/v1/admin/articles/index.ts";
import registerCommonSchemas from "../src/schemas/common.ts";
import registerArticleSchemas from "../src/schemas/article.ts";
import registerTemplateSchemas from "../src/schemas/template.ts";
import errorHandlerPlugin from "../src/plugins/external/error-handler.ts";
import { ArticleService, CategoryService } from "../src/services/article.service.ts";
import { ArticleErrorCode, CategoryErrorCode } from "../src/constants/business-codes/article.ts";
import { BusinessError } from "../src/exceptions/business-error.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate("authenticate", async (request: any) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      const error = new Error("Unauthorized") as any;
      error.statusCode = 401;
      throw error;
    }
    request.currentUser = { id: 1, username: "admin" };
  });
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/api/v1/admin/")) {
      return (app as any).authenticate(request, reply);
    }
  });
  await app.register(errorHandlerPlugin);
  registerCommonSchemas(app);
  registerArticleSchemas(app);
  registerTemplateSchemas(app);
  await app.register(adminArticlesPlugin, { prefix: "/api/v1/admin/articles" });
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Admin Articles routes", () => {
  it("GET /api/v1/admin/articles 返回分页列表", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const list = [
      {
        id: 1,
        title: "欢迎使用门户",
        content: "内容",
        status: "0",
        createdAt: now,
        updatedAt: now,
      },
    ] as any;
    vi.spyOn(ArticleService, "getArticleList").mockResolvedValue({ list, total: 1, page: 1, pageSize: 10 });

    const res = await app.inject({ method: "GET", url: "/api/v1/admin/articles?page=1&pageSize=10", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination.total).toBe(1);
    await app.close();
  });

  it("GET /api/v1/admin/articles 未授权返回401", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/articles?page=1&pageSize=10" });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    await app.close();
  });

  it("GET /api/v1/admin/articles/:id 成功获取详情", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const detail = { id: 10, title: "文章10", content: "正文", status: "1", createdAt: now, updatedAt: now } as any;
    vi.spyOn(ArticleService, "getArticleById").mockResolvedValue(detail);
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/articles/10", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 10 });
    await app.close();
  });

  it("POST /api/v1/admin/articles 成功创建文章", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const created = { id: 101, title: "新文章", content: "正文", status: "0", createdAt: now, updatedAt: now } as any;
    vi.spyOn(ArticleService, "createArticle").mockResolvedValue(created);
    const res = await app.inject({ method: "POST", url: "/api/v1/admin/articles", headers: { Authorization: "Bearer t" }, payload: { title: "新文章", content: "正文" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 101, title: "新文章" });
    await app.close();
  });

  it("PUT /api/v1/admin/articles/:id 成功更新文章", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const updated = { id: 8, title: "更新后", content: "正文", status: "1", createdAt: now, updatedAt: now } as any;
    vi.spyOn(ArticleService, "updateArticle").mockResolvedValue(updated);
    const res = await app.inject({ method: "PUT", url: "/api/v1/admin/articles/8", headers: { Authorization: "Bearer t" }, payload: { title: "更新后" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 8, title: "更新后" });
    await app.close();
  });

  it("DELETE /api/v1/admin/articles/:id 成功删除文章", async () => {
    const app = await buildApp();
    vi.spyOn(ArticleService, "deleteArticle").mockResolvedValue({ id: 5 } as any);
    const res = await app.inject({ method: "DELETE", url: "/api/v1/admin/articles/5", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 5 });
    await app.close();
  });

  it("POST /api/v1/admin/articles/:id/publish 成功发布文章", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const published = { id: 7, title: "发布", content: "正文", status: "1", publishTime: now, createdAt: now, updatedAt: now } as any;
    vi.spyOn(ArticleService, "publishArticle").mockResolvedValue(published);
    const res = await app.inject({ method: "POST", url: "/api/v1/admin/articles/7/publish", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 7, status: "1" });
    await app.close();
  });

  it("GET /api/v1/admin/articles/categories 返回分类列表", async () => {
    const app = await buildApp();
    const now = new Date().toISOString();
    const list = [{ id: 1, name: "新闻", status: "1", sort_order: 0, createdAt: now, updatedAt: now } ] as any;
    vi.spyOn(CategoryService, "getCategoryList").mockResolvedValue({ list, total: 1, page: 1, pageSize: 10 });
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/articles/categories?page=1&pageSize=10", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });

  it("GET /api/v1/admin/articles/:id 不存在返回业务错误", async () => {
    const app = await buildApp();
    vi.spyOn(ArticleService, "getArticleById").mockRejectedValue(new BusinessError(ArticleErrorCode.ARTICLE_NOT_FOUND, "文章不存在"));
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/articles/9999", headers: { Authorization: "Bearer t" } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(ArticleErrorCode.ARTICLE_NOT_FOUND);
    await app.close();
  });
});

