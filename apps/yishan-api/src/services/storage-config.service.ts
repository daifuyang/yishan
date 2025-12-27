import { BusinessError } from "../exceptions/business-error.js";
import { ValidationErrorCode } from "../constants/business-codes/validation.js";
import { SystemOptionService } from "./system-option.service.js";

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

export type StorageConfig = {
  provider: StorageProvider;
  qiniu: QiniuConfig;
  aliyunOss: AliyunOssConfig;
};

export type StorageConfigExportPayload = {
  format: "yishan.storage.config";
  version: 1;
  exportedAt: string;
  provider: StorageProvider;
  qiniu: QiniuConfig;
  aliyunOss: AliyunOssConfig;
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

const validateProvider = (provider: any): StorageProvider => {
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

export class StorageConfigService {
  static async getConfig(): Promise<StorageConfig> {
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

  static async upsertConfig(
    payload: {
      provider: StorageProvider;
      qiniu?: Partial<QiniuConfig>;
      aliyunOss?: Partial<AliyunOssConfig>;
    },
    userId: number
  ): Promise<StorageConfig> {
    await this.importConfig(payload, userId);
    return await this.getConfig();
  }

  static async exportConfig(): Promise<StorageConfigExportPayload> {
    const cfg = await this.getConfig();
    return {
      format: "yishan.storage.config",
      version: 1,
      exportedAt: new Date().toISOString(),
      provider: cfg.provider,
      qiniu: cfg.qiniu,
      aliyunOss: cfg.aliyunOss,
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

    if (provider === "qiniu") {
      validateQiniuConfig(payload.qiniu || {});
    }
    if (provider === "aliyunOss") {
      validateAliyunOssConfig(payload.aliyunOss || {});
    }

    const items: Array<{ key: string; value: string }> = [];
    if (provider === "disabled") {
      items.push(
        { key: SYSTEM_OPTION_KEYS.QINIU, value: "" },
        { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: "" },
        { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: modeFromProvider(provider) }
      );
    }

    if (provider === "qiniu") {
      const qiniu = { ...DEFAULT_QINIU, ...(payload.qiniu || {}), provider: "qiniu" as const };
      items.push(
        { key: SYSTEM_OPTION_KEYS.QINIU, value: JSON.stringify(qiniu) },
        { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: "" },
        { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: modeFromProvider(provider) }
      );
    }

    if (provider === "aliyunOss") {
      const aliyunOss = { ...DEFAULT_ALIYUN_OSS, ...(payload.aliyunOss || {}), provider: "aliyunOss" as const };
      items.push(
        { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: JSON.stringify(aliyunOss) },
        { key: SYSTEM_OPTION_KEYS.QINIU, value: "" },
        { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: modeFromProvider(provider) }
      );
    }

    for (const item of items) {
      await SystemOptionService.setOption(item.key, item.value, userId);
    }

    return { provider };
  }
}
