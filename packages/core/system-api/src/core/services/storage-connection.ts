import { createHmac } from "node:crypto";
import qiniu from "qiniu";
import type { AliyunOssConfig, QiniuConfig } from "./storage-config.service.js";

/** 单次探测的超时：移动端用户在等结果，宁可快速失败也不要长时间挂起。 */
const PROBE_TIMEOUT_MS = 8000;

export type ProbeResult = { ok: true } | { ok: false; message: string };

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "连接超时";
    return error.message || "连接失败";
  }
  return "连接失败";
};

/** 七牛：用账号密钥查询空间信息，能区分密钥错误与空间不存在。 */
export async function probeQiniu(cfg: QiniuConfig): Promise<ProbeResult> {
  const mac = new qiniu.auth.digest.Mac(cfg.accessKey, cfg.secretKey);
  const manager = new qiniu.rs.BucketManager(mac, new qiniu.conf.Config({ useHttpsDomain: cfg.useHttps !== false }));
  try {
    const result = await Promise.race([
      manager.getBucketInfo(cfg.bucket),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error("连接超时"), { name: "TimeoutError" })), PROBE_TIMEOUT_MS)
      ),
    ]);
    if (result.ok()) return { ok: true };
    const status = result.resp.statusCode;
    const detail = (result.data as { error?: string } | undefined)?.error;
    if (status === 401) return { ok: false, message: "AccessKey 或 SecretKey 不正确" };
    if (status === 612 || status === 631) return { ok: false, message: `空间 ${cfg.bucket} 不存在` };
    return { ok: false, message: detail || `七牛云返回 ${status}` };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

/** OSS 访问域名：优先 endpoint，否则由 region（如 oss-cn-hangzhou）推导。 */
export function ossHost(cfg: Pick<AliyunOssConfig, "bucket" | "endpoint" | "region">): string {
  const endpoint = String(cfg.endpoint || "").trim().replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
  const region = String(cfg.region || "").trim();
  const base = endpoint || `${region.startsWith("oss-") ? region : `oss-${region}`}.aliyuncs.com`;
  return base.startsWith(`${cfg.bucket}.`) ? base : `${cfg.bucket}.${base}`;
}

/**
 * OSS：GetBucketInfo，按 OSS V1 签名（HMAC-SHA1）直接请求，避免为一次探测引入 SDK。
 * https://help.aliyun.com/zh/oss/developer-reference/getbucketinfo
 */
export async function probeAliyunOss(cfg: AliyunOssConfig): Promise<ProbeResult> {
  const date = new Date().toUTCString();
  const resource = `/${cfg.bucket}/?bucketInfo`;
  const signature = createHmac("sha1", cfg.accessKeySecret).update(`GET\n\n\n${date}\n${resource}`).digest("base64");
  const protocol = cfg.useHttps === false ? "http" : "https";
  try {
    const response = await fetch(`${protocol}://${ossHost(cfg)}/?bucketInfo`, {
      headers: { Date: date, Authorization: `OSS ${cfg.accessKeyId}:${signature}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };
    const text = await response.text();
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
    if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch")
      return { ok: false, message: "AccessKeyId 或 AccessKeySecret 不正确" };
    if (code === "NoSuchBucket") return { ok: false, message: `空间 ${cfg.bucket} 不存在` };
    const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1];
    return { ok: false, message: message || `OSS 返回 ${response.status}` };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}
