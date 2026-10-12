import { OptionRepository } from "../repositories/option.repository.js";

export type SystemOptionKey = string;

/**
 * 含密钥的 option 及其密钥字段。读取时剔除密钥；写入时密钥留空表示保留旧值。
 * 七牛与阿里云 OSS 必须一致处理，否则任一通道都会把明文密钥下发给前端。
 */
const SECRET_FIELDS: Readonly<Record<string, string>> = Object.freeze({
  qiniuConfig: "secretKey",
  aliyunOssConfig: "accessKeySecret",
});

const safeParseJsonObject = (text: string | null | undefined): Record<string, any> | null => {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const v = JSON.parse(trimmed);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as any;
    return null;
  } catch {
    return null;
  }
};

const sanitizeSecretValue = (key: SystemOptionKey, value: string | null): string | null => {
  const field = SECRET_FIELDS[key];
  if (!field) return value;
  const obj = safeParseJsonObject(value);
  if (!obj) return value;
  const out = { ...obj };
  delete (out as any)[field];
  return JSON.stringify(out);
};

export class SystemOptionService {
  static async getOption(key: SystemOptionKey): Promise<string | null> {
    return await OptionRepository.getOptionValue(key);
  }

  static async getOptionPublic(key: SystemOptionKey): Promise<string | null> {
    return sanitizeSecretValue(key, await this.getOption(key));
  }

  static async setOption(key: SystemOptionKey, value: string, userId: number): Promise<string> {
    const field = SECRET_FIELDS[key];
    if (field) {
      const currentRaw = await OptionRepository.getOptionValue(key);
      const currentObj = safeParseJsonObject(currentRaw) || {};
      const patchObj = safeParseJsonObject(value);
      if (!patchObj) {
        const stored = await OptionRepository.setOptionValue(key, value, userId);
        return sanitizeSecretValue(key, stored) as any;
      }

      const merged = { ...currentObj, ...patchObj } as any;
      const nextSecret = typeof patchObj[field] === "string" ? patchObj[field].trim() : "";
      if (nextSecret) merged[field] = nextSecret;
      else if (typeof currentObj[field] === "string" && currentObj[field].trim()) merged[field] = currentObj[field];
      else delete merged[field];

      const stored = await OptionRepository.setOptionValue(key, JSON.stringify(merged), userId);
      return sanitizeSecretValue(key, stored) as any;
    }

    return await OptionRepository.setOptionValue(key, value, userId);
  }

  static async getOptions(keys: SystemOptionKey[]): Promise<Record<SystemOptionKey, string | null>> {
    const result = {} as Record<SystemOptionKey, string | null>;
    for (const k of keys) {
      result[k] = await this.getOption(k);
    }
    return result;
  }

  static async getOptionsPublic(keys: SystemOptionKey[]): Promise<Record<SystemOptionKey, string | null>> {
    const map = await this.getOptions(keys);
    for (const key of keys) {
      if (key in map) map[key] = sanitizeSecretValue(key, map[key]);
    }
    return map;
  }
}
