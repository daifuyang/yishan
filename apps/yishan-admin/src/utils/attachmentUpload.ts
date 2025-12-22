import { batchGetSystemOptionByQuery, getQiniuUploadToken } from "@/services/yishan-admin/system";
import { createCloudAttachment, uploadAttachments } from "@/services/yishan-admin/attachments";

export type StorageProvider = "disabled" | "qiniu" | "aliyunOss";

export type CloudStorageConfig = {
  provider: StorageProvider;
  qiniu?: {
    domain?: string;
    uploadHost?: string;
  };
};

let cloudStorageConfigCache: { value: CloudStorageConfig; expiresAt: number } | null = null;

export const fetchCloudStorageConfig = async (options?: { force?: boolean }): Promise<CloudStorageConfig> => {
  const now = Date.now();
  if (!options?.force && cloudStorageConfigCache && cloudStorageConfigCache.expiresAt > now) {
    return cloudStorageConfigCache.value;
  }

  try {
    const res = await batchGetSystemOptionByQuery({
      key: ["systemStorage", "qiniuConfig", "aliyunOssConfig"] as any,
    } as any);
    const results = res.data?.results || [];
    const map = results.reduce<Record<string, string | null>>((acc, item) => {
      if (item?.key) acc[String(item.key)] = item.value ?? null;
      return acc;
    }, {});

    const mode = String(map.systemStorage ?? "0");
    const provider: StorageProvider = mode === "1" ? "qiniu" : mode === "2" ? "aliyunOss" : "disabled";

    const qiniuText = map.qiniuConfig;
    let qiniu: CloudStorageConfig["qiniu"];
    if (typeof qiniuText === "string" && qiniuText.trim()) {
      try {
        const obj = JSON.parse(qiniuText);
        qiniu = { domain: obj?.domain, uploadHost: obj?.uploadHost };
      } catch {
        qiniu = undefined;
      }
    }

    const cfg: CloudStorageConfig = { provider, qiniu };
    cloudStorageConfigCache = { value: cfg, expiresAt: now + 30_000 };
    return cfg;
  } catch {
    if (cloudStorageConfigCache) {
      cloudStorageConfigCache = { value: cloudStorageConfigCache.value, expiresAt: now + 5_000 };
      return cloudStorageConfigCache.value;
    }
    const cfg: CloudStorageConfig = { provider: "disabled" };
    cloudStorageConfigCache = { value: cfg, expiresAt: now + 5_000 };
    return cfg;
  }
};

const uploadToQiniu = async (
  file: File,
  cfg: CloudStorageConfig,
  options?: {
    dir?: string;
  }
): Promise<{ objectKey: string; hash?: string }> => {
  const dir = String(options?.dir || "attachments").replace(/\/+$/, "");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const objectKey = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;

  const tokenRes = await getQiniuUploadToken({ scopeKey: objectKey } as any);
  const token = (tokenRes as any)?.data?.token;
  if (!token) {
    throw new Error("获取上传凭证失败");
  }

  const uploadUrl =
    (tokenRes as any)?.data?.uploadUrl || cfg.qiniu?.uploadHost || "https://upload.qiniup.com";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("token", token);
  formData.append("key", objectKey);

  const resp = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(`upload failed: ${resp.status}`);
  const data = await resp.json().catch(() => ({} as any));

  const finalKey = String((data as any)?.key || objectKey);
  return { objectKey: finalKey, hash: (data as any)?.hash };
};

export const uploadAttachmentFile = async (
  file: File,
  params: {
    folderId?: number;
    kind?: API.sysAttachment["kind"];
    name?: string;
    dir?: string;
  }
): Promise<API.uploadAttachmentsResp> => {
  const cfg = await fetchCloudStorageConfig();
  if (cfg.provider === "qiniu") {
    const uploaded = await uploadToQiniu(file, cfg, { dir: params.dir || "attachments" });
    return await createCloudAttachment({
      storage: "qiniu",
      objectKey: uploaded.objectKey,
      folderId: params.folderId,
      kind: params.kind,
      name: params.name,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      hash: uploaded.hash,
    });
  }

  const formData = new FormData();
  formData.append("file", file);
  return await uploadAttachments(
    {
      folderId: params.folderId,
      kind: params.kind,
      name: params.name,
    },
    { data: formData }
  );
};

const isAbsoluteUrl = (value: string) => /^(https?:)?\/\//i.test(value) || value.startsWith("data:");

const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
};

export const resolveAttachmentPublicUrl = (
  input: Pick<API.sysAttachment, "url" | "path" | "objectKey" | "storage"> | string | undefined | null,
  cfg?: CloudStorageConfig
) => {
  const raw =
    typeof input === "string"
      ? input
      : input
        ? String(input.url || input.objectKey || input.path || "")
        : "";
  const value = String(raw || "").trim();
  if (!value) return "";
  if (isAbsoluteUrl(value)) return value;

  const storage = typeof input === "string" ? undefined : (input?.storage ? String(input.storage) : undefined);
  if (storage === "qiniu" || cfg?.provider === "qiniu") {
    let domain = String(cfg?.qiniu?.domain || "").trim();
    if (!domain) return value;
    if (!isAbsoluteUrl(domain)) domain = `https://${domain.replace(/^\/+/, "")}`;
    return joinUrl(domain, value);
  }

  return value;
};

export const normalizeAttachmentStoredValue = (value: string, cfg?: CloudStorageConfig) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const domainText = String(cfg?.qiniu?.domain || "").trim();
  if (!domainText) return raw;

  const domainAbs = isAbsoluteUrl(domainText) ? domainText.replace(/\/+$/, "") : `https://${domainText.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const domainNoProto = domainAbs.replace(/^https?:\/\//i, "");

  const urlAbs = isAbsoluteUrl(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  const urlNoProto = urlAbs.replace(/^https?:\/\//i, "");

  if (!urlNoProto.toLowerCase().startsWith(`${domainNoProto.toLowerCase()}/`)) return raw;
  const rest = urlNoProto.slice(domainNoProto.length);
  return rest.replace(/^\/+/, "");
};

