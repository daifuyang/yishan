import { BusinessError } from "@yishan/core-api/errors";
import { ValidationErrorCode } from "@yishan/core-api/business-codes/validation";
import { SystemOptionService } from "./system-option.service.js";
import { probeAliyunOss, probeQiniu } from "./storage-connection.js";

export type QiniuRegion = "z0" | "z1" | "z2" | "na0" | "as0";
export type StorageProvider = "disabled" | "qiniu" | "aliyunOss";

export type QiniuConfig = {
  provider?: "qiniu";
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: QiniuRegion;
  domain?: string;
  useHttps?: boolean;
  useCdnDomains?: boolean;
  tokenExpires?: number;
  callbackUrl?: string;
  uploadHost?: string;
};

export type QiniuConfigPublic = Omit<QiniuConfig, "secretKey">;

export type AliyunOssConfig = {
  provider?: "aliyunOss";
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint?: string;
  domain?: string;
  useHttps?: boolean;
};

export type AliyunOssConfigPublic = Omit<AliyunOssConfig, "accessKeySecret">;

export type StorageConfig = {
  provider: StorageProvider;
  qiniu: QiniuConfig;
  aliyunOss: AliyunOssConfig;
};

export type StorageConfigPublic = Omit<StorageConfig, "qiniu" | "aliyunOss"> & {
  qiniu: QiniuConfigPublic;
  aliyunOss: AliyunOssConfigPublic;
};

export type StorageConfigExportPayload = {
  format: "yishan.storage.config";
  version: 1;
  exportedAt: string;
  provider: StorageProvider;
  qiniu: QiniuConfig;
  aliyunOss: AliyunOssConfig;
};

export type StorageConfigExportPayloadPublic = Omit<StorageConfigExportPayload, "qiniu" | "aliyunOss"> & {
  qiniu: QiniuConfigPublic;
  aliyunOss: AliyunOssConfigPublic;
};

export type StorageConnectionResult = {
  ok: boolean;
  provider: Exclude<StorageProvider, "disabled">;
  bucket: string;
  latencyMs: number;
  message?: string;
};

type StorageConfigPayload = {
  provider: StorageProvider;
  qiniu?: Partial<QiniuConfig>;
  aliyunOss?: Partial<AliyunOssConfig>;
};

const SYSTEM_OPTION_KEYS = {
  SYSTEM_STORAGE: "systemStorage",
  QINIU: "qiniuConfig",
  ALIYUN_OSS: "aliyunOssConfig",
} as const;

const DEFAULT_QINIU: QiniuConfig = {
  provider: "qiniu",
  accessKey: "",
  secretKey: "",
  bucket: "",
  region: "z0",
  domain: "",
  useHttps: true,
  useCdnDomains: true,
  tokenExpires: 3600,
  callbackUrl: "",
  uploadHost: "",
};

const DEFAULT_ALIYUN_OSS: AliyunOssConfig = {
  provider: "aliyunOss",
  accessKeyId: "",
  accessKeySecret: "",
  bucket: "",
  region: "",
  endpoint: "",
  domain: "",
  useHttps: true,
};

const parseJson = <T,>(text: string | null | undefined, fallback: T): T => {
  if (typeof text !== "string") return fallback;
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(trimmed) || {}) };
  } catch {
    return fallback;
  }
};

const validateProvider = (provider: unknown): StorageProvider => {
  if (provider === "disabled" || provider === "qiniu" || provider === "aliyunOss") return provider;
  throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "provider 参数不合法");
};

const validateQiniuConfig = (cfg: Partial<QiniuConfig>) => {
  const accessKey = String(cfg.accessKey || "").trim();
  const secretKey = String(cfg.secretKey || "").trim();
  const bucket = String(cfg.bucket || "").trim();
  const region = cfg.region;
  const regionOk = region === "z0" || region === "z1" || region === "z2" || region === "na0" || region === "as0";
  if (!accessKey || !secretKey || !bucket || !regionOk) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "七牛云配置不完整");
  }
};

const validateAliyunOssConfig = (cfg: Partial<AliyunOssConfig>) => {
  const accessKeyId = String(cfg.accessKeyId || "").trim();
  const accessKeySecret = String(cfg.accessKeySecret || "").trim();
  const bucket = String(cfg.bucket || "").trim();
  const region = String(cfg.region || "").trim();
  if (!accessKeyId || !accessKeySecret || !bucket || !region) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "阿里云 OSS 配置不完整");
  }
};

const providerFromMode = (mode: string): StorageProvider => {
  if (mode === "1") return "qiniu";
  if (mode === "2") return "aliyunOss";
  return "disabled";
};

const modeFromProvider = (provider: StorageProvider): "0" | "1" | "2" => {
  if (provider === "qiniu") return "1";
  if (provider === "aliyunOss") return "2";
  return "0";
};

const toPublicQiniu = (cfg: QiniuConfig): QiniuConfigPublic => {
  const { secretKey: _secretKey, ...rest } = cfg;
  return rest;
};

const toPublicAliyunOss = (cfg: AliyunOssConfig): AliyunOssConfigPublic => {
  const { accessKeySecret: _accessKeySecret, ...rest } = cfg;
  return rest;
};

/** 表单草稿叠加到已存配置上；草稿密钥留空表示沿用已存密钥（前端拿不到明文密钥）。 */
const mergeQiniuDraft = (current: QiniuConfig, patch: Partial<QiniuConfig> = {}): QiniuConfig => {
  const prev = { ...DEFAULT_QINIU, ...(current || {}), provider: "qiniu" as const };
  const next: QiniuConfig = { ...prev, ...patch, provider: "qiniu" as const };
  const nextSecret = typeof patch.secretKey === "string" ? patch.secretKey.trim() : "";
  next.secretKey = nextSecret || prev.secretKey;
  return next;
};

const mergeAliyunOssDraft = (current: AliyunOssConfig, patch: Partial<AliyunOssConfig> = {}): AliyunOssConfig => {
  const prev = { ...DEFAULT_ALIYUN_OSS, ...(current || {}), provider: "aliyunOss" as const };
  const next: AliyunOssConfig = { ...prev, ...patch, provider: "aliyunOss" as const };
  const nextSecret = typeof patch.accessKeySecret === "string" ? patch.accessKeySecret.trim() : "";
  next.accessKeySecret = nextSecret || prev.accessKeySecret;
  return next;
};

export class StorageConfigService {
  private static async getInternalConfig(): Promise<StorageConfig> {
    const map = await SystemOptionService.getOptions([
      SYSTEM_OPTION_KEYS.SYSTEM_STORAGE,
      SYSTEM_OPTION_KEYS.QINIU,
      SYSTEM_OPTION_KEYS.ALIYUN_OSS,
    ]);

    const provider = providerFromMode(String(map[SYSTEM_OPTION_KEYS.SYSTEM_STORAGE] ?? "0"));
    const qiniu = parseJson<QiniuConfig>(map[SYSTEM_OPTION_KEYS.QINIU], DEFAULT_QINIU);
    const aliyunOss = parseJson<AliyunOssConfig>(map[SYSTEM_OPTION_KEYS.ALIYUN_OSS], DEFAULT_ALIYUN_OSS);

    return { provider, qiniu, aliyunOss };
  }

  static async getConfig(): Promise<StorageConfigPublic> {
    const cfg = await this.getInternalConfig();
    return { ...cfg, qiniu: toPublicQiniu(cfg.qiniu), aliyunOss: toPublicAliyunOss(cfg.aliyunOss) };
  }

  static async upsertConfig(
    payload: {
      provider: StorageProvider;
      qiniu?: Partial<QiniuConfig>;
      aliyunOss?: Partial<AliyunOssConfig>;
    },
    userId: number
  ): Promise<StorageConfigPublic> {
    await this.importConfig(payload, userId);
    return await this.getConfig();
  }

  static async exportConfig(): Promise<StorageConfigExportPayloadPublic> {
    const cfg = await this.getInternalConfig();
    return {
      format: "yishan.storage.config",
      version: 1,
      exportedAt: new Date().toISOString(),
      provider: cfg.provider,
      qiniu: toPublicQiniu(cfg.qiniu),
      aliyunOss: toPublicAliyunOss(cfg.aliyunOss),
    };
  }

  static async importConfig(
    payload: {
      provider: StorageProvider;
      qiniu?: Partial<QiniuConfig>;
      aliyunOss?: Partial<AliyunOssConfig>;
    },
    userId: number
  ): Promise<{ provider: StorageProvider }> {
    const provider = validateProvider(payload.provider);

    const current = await this.getInternalConfig();

    const items: Array<{ key: string; value: string }> = [];
    if (provider === "disabled") {
      items.push(
        { key: SYSTEM_OPTION_KEYS.QINIU, value: "" },
        { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: "" },
        { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: modeFromProvider(provider) }
      );
    }

    if (provider === "qiniu") {
      const next = mergeQiniuDraft(current.qiniu, payload.qiniu);

      validateQiniuConfig(next);
      items.push(
        { key: SYSTEM_OPTION_KEYS.QINIU, value: JSON.stringify(next) },
        { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: "" },
        { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: modeFromProvider(provider) }
      );
    }

    if (provider === "aliyunOss") {
      const next = mergeAliyunOssDraft(current.aliyunOss, payload.aliyunOss);

      validateAliyunOssConfig(next);
      items.push(
        { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: JSON.stringify(next) },
        { key: SYSTEM_OPTION_KEYS.QINIU, value: "" },
        { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: modeFromProvider(provider) }
      );
    }

    for (const item of items) {
      await SystemOptionService.setOption(item.key, item.value, userId);
    }

    return { provider };
  }

  /**
   * 用表单草稿（未保存）测试连接：与保存走同一套合并与校验，测试通过的配置保存后行为一致。
   * 连接失败是正常的测试结果（ok=false），只有草稿本身不完整才抛校验错误。
   */
  static async testConnection(payload: StorageConfigPayload): Promise<StorageConnectionResult> {
    const provider = validateProvider(payload.provider);
    if (provider === "disabled") {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "未启用云存储，无需测试连接");
    }
    const current = await this.getInternalConfig();
    const startedAt = Date.now();
    if (provider === "qiniu") {
      const cfg = mergeQiniuDraft(current.qiniu, payload.qiniu);
      validateQiniuConfig(cfg);
      const result = await probeQiniu(cfg);
      return { ...result, provider, bucket: cfg.bucket, latencyMs: Date.now() - startedAt };
    }
    const cfg = mergeAliyunOssDraft(current.aliyunOss, payload.aliyunOss);
    validateAliyunOssConfig(cfg);
    const result = await probeAliyunOss(cfg);
    return { ...result, provider, bucket: cfg.bucket, latencyMs: Date.now() - startedAt };
  }
}
