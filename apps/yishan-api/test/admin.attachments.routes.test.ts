import Fastify from "fastify";
import { describe, it, expect, vi, beforeEach } from "vitest";
import multipartPlugin from "../src/plugins/external/multipart.ts";
import staticPlugin from "../src/plugins/external/static.ts";
import errorHandlerPlugin from "../src/plugins/external/error-handler.ts";
import adminAttachmentsPlugin from "../src/routes/api/v1/admin/attachments/index.ts";
import registerCommonSchemas from "../src/schemas/common.ts";
import registerAttachmentSchemas from "../src/schemas/attachment.ts";
import { AttachmentService } from "../src/services/attachment.service.ts";
import { join } from "node:path";
import { promises as fs } from "node:fs";

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
  await app.register(multipartPlugin);
  await app.register(staticPlugin);
  registerCommonSchemas(app);
  registerAttachmentSchemas(app);
  await app.register(adminAttachmentsPlugin, { prefix: "/api/v1/admin/attachments" });
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

function buildMultipartBody(boundary: string, parts: Array<{ name: string; filename: string; contentType: string; content: string }>) {
  const lines: string[] = [];
  for (const p of parts) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"`);
    lines.push(`Content-Type: ${p.contentType}`);
    lines.push("");
    lines.push(p.content);
  }
  lines.push(`--${boundary}--`);
  lines.push("");
  return lines.join("\r\n");
}

describe("Admin Attachments routes", () => {
  it("POST /api/v1/admin/attachments 返回上传结果并包含素材ID", async () => {
    const app = await buildApp();

    vi.spyOn(AttachmentService, "getAttachmentByHash").mockResolvedValue(null as any);
    vi.spyOn(AttachmentService, "createLocalAttachment").mockImplementation(async (input: any) => {
      expect(input.hash).toBe("bff139fa05ac583f685a523ab3d110a0");
      return {
        id: 10,
        kind: input.kind || "image",
        filename: input.filename,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        path: input.path,
        url: input.url,
        status: "1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;
    });

    const boundary = "----yishan-boundary";
    const payload = buildMultipartBody(boundary, [
      {
        name: "file",
        filename: "a.png",
        contentType: "image/png",
        content: "png",
      },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/attachments?folderId=1",
      payload,
      headers: {
        Authorization: "Bearer t",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toMatchObject({ id: 10 });
    expect(typeof body.data[0].filename).toBe("string");

    const uploadRoot = join(process.cwd(), "public", "uploads");
    await fs.rm(join(uploadRoot, body.data[0].filename), { force: true });

    await app.close();
  });

  it("POST /api/v1/admin/attachments 内容重复时复用已有素材", async () => {
    const app = await buildApp();

    vi.spyOn(AttachmentService, "getAttachmentByHash").mockResolvedValue({
      id: 99,
      kind: "image",
      filename: "exists.png",
      originalName: "exists.png",
      mimeType: "image/png",
      size: 3,
      path: "/uploads/exists.png",
      url: "/uploads/exists.png",
      storage: "local",
      status: "1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    const createSpy = vi.spyOn(AttachmentService, "createLocalAttachment");

    const boundary = "----yishan-boundary";
    const payload = buildMultipartBody(boundary, [
      {
        name: "file",
        filename: "dup.png",
        contentType: "image/png",
        content: "png",
      },
    ]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/attachments?folderId=1",
      payload,
      headers: {
        Authorization: "Bearer t",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data[0]).toMatchObject({ id: 99, filename: "exists.png" });
    expect(createSpy).not.toHaveBeenCalled();

    await app.close();
  });

  it("DELETE /api/v1/admin/attachments 支持批量删除", async () => {
    const app = await buildApp();

    vi.spyOn(AttachmentService, "deleteAttachments").mockResolvedValue({ ids: [1, 2] } as any);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/attachments",
      payload: { ids: [1, 2] },
      headers: {
        Authorization: "Bearer t",
        "content-type": "application/json",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ ids: [1, 2] });

    await app.close();
  });

  it("GET /api/v1/admin/attachments 未授权返回401", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/attachments?page=1&pageSize=10" });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    await app.close();
  });
});
