import { OptionRepository } from "../repositories/option.repository.js";

export type SystemOptionKey = string;

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

const sanitizeQiniuConfigValue = (value: string | null): string | null => {
  const obj = safeParseJsonObject(value);
  if (!obj) return value;
  const out = { ...obj };
  delete (out as any).secretKey;
  return JSON.stringify(out);
};

export class SystemOptionService {
  static async getOption(key: SystemOptionKey): Promise<string | null> {
    return await OptionRepository.getOptionValue(key);
  }

  static async getOptionPublic(key: SystemOptionKey): Promise<string | null> {
    const value = await this.getOption(key);
    if (key === "qiniuConfig") return sanitizeQiniuConfigValue(value);
    return value;
  }

  static async setOption(key: SystemOptionKey, value: string, userId: number): Promise<string> {
    if (key === "qiniuConfig") {
      const currentRaw = await OptionRepository.getOptionValue(key);
      const currentObj = safeParseJsonObject(currentRaw) || {};
      const patchObj = safeParseJsonObject(value);
      if (!patchObj) {
        const stored = await OptionRepository.setOptionValue(key, value, userId);
        return sanitizeQiniuConfigValue(stored) as any;
      }

      const merged = { ...currentObj, ...patchObj } as any;
      const nextSecret = typeof patchObj.secretKey === "string" ? patchObj.secretKey.trim() : "";
      if (nextSecret) merged.secretKey = nextSecret;
      else if (typeof currentObj.secretKey === "string" && currentObj.secretKey.trim()) merged.secretKey = currentObj.secretKey;
      else delete merged.secretKey;

      const stored = await OptionRepository.setOptionValue(key, JSON.stringify(merged), userId);
      return sanitizeQiniuConfigValue(stored) as any;
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
    if (keys.includes("qiniuConfig")) {
      (map as any)["qiniuConfig"] = sanitizeQiniuConfigValue((map as any)["qiniuConfig"]);
    }
    return map;
  }
}
