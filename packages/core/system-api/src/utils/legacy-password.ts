/**
 * 历史密码格式兼容层（ThinkCMF 5.x / 老 iximei）。
 *
 * 与 `password.ts` **完全隔离** —— 不进 `verifyPassword` 的算法回退路径，
 * 只在登录主流程读到 `sys_user.password_format === 0` 时显式调用。
 * 任何"由 verifyPassword 隐式回退到这里"的做法都会把老算法变成隐式弱认证。
 *
 * 算法（https://github.com/thinkcmf/cmf-core, src/common.php::cmf_password）：
 *   hash = '###' + md5(md5(authcode + 明文))
 *
 *   $result = "###" . md5(md5($authCode . $pw));
 *
 * 其中 authcode 是部署期写死在 `data/config/database.php` 的全局常量。
 * 必须由环境变量 `LEGACY_AUTHCODE` 注入：源码里不留默认值，
 * 未配置时该分支恒返回 invalid，而不是"猜一个默认值碰运气"。
 *
 * 生命周期：
 *   - 老库导入时把 `password_format` 回填 0（hash 原样保留，不动）
 *   - 用户首次用老密码登录成功 → AuthService 把它升级成 scrypt 并置 format=1
 *   - `password_change_recommended` 与算法**解耦**，一直保留到用户主动改密
 */

import { createHash, timingSafeEqual } from 'node:crypto';

/** `sys_user.password_format` 的取值。 */
export const PASSWORD_FORMAT_LEGACY = 0;
export const PASSWORD_FORMAT_SCRYPT_V1 = 1;

export type PasswordFormat =
  | typeof PASSWORD_FORMAT_LEGACY
  | typeof PASSWORD_FORMAT_SCRYPT_V1;

const PAYLOAD_HEX_REGEX = /^[0-9a-f]{32}$/i;

/**
 * 读取部署期的 authcode。每次调用都读 env，方便测试里改。
 * 未配置（或空串）返回 null —— 调用方据此直接判定不可校验。
 *
 * 同时接受 `LEGACY_IXIMEI_AUTHCODE` 这个历史变量名：老 iximei 部署的
 * `.env` 里已经是这个名字，切换基座时不用改线上配置。
 */
export function resolveLegacyAuthCode(): string | null {
  const raw = process.env.LEGACY_AUTHCODE ?? process.env.LEGACY_IXIMEI_AUTHCODE;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isLegacyPasswordSupported(): boolean {
  return resolveLegacyAuthCode() !== null;
}

/**
 * 识别 `###` + 32 位 hex。识别失败返回 null。
 * 不做任何"猜格式"的尝试 —— 偏离这种格式即无效。
 */
export function parseThinkCmfLegacyHash(hash: unknown): Buffer | null {
  if (typeof hash !== 'string' || !hash.startsWith('###')) return null;
  const payload = hash.slice(3);
  if (!PAYLOAD_HEX_REGEX.test(payload)) return null;
  return Buffer.from(payload, 'hex');
}

function doubleMd5(authCode: string, plaintext: string): string {
  // 第一次 md5 必须取 hex 字符串，因为 PHP 的 md5() 返回 hex；
  // 若把 16 字节 raw buffer 喂给第二次 md5，结果完全不同。
  const once = createHash('md5').update(authCode + plaintext, 'utf8').digest('hex');
  return createHash('md5').update(once, 'utf8').digest('hex');
}

export type LegacyVerification =
  | { valid: true }
  | { valid: false; reason: 'malformed' | 'empty' | 'authcode_missing' };

/**
 * 校验明文是否匹配老 iximei 风格的 `###<md5>`。
 *
 * 调用方**必须**先确认 `password_format === 0`。使用 constant-time 比较，
 * 任何异常路径都返回 `{ valid: false }`，不抛错。
 */
export function verifyLegacyPassword(plaintext: string, hash: unknown): LegacyVerification {
  const payload = parseThinkCmfLegacyHash(hash);
  if (!payload) return { valid: false, reason: 'malformed' };
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    return { valid: false, reason: 'empty' };
  }

  const authCode = resolveLegacyAuthCode();
  if (!authCode) return { valid: false, reason: 'authcode_missing' };

  const actual = Buffer.from(doubleMd5(authCode, plaintext), 'hex');
  if (actual.length !== payload.length) return { valid: false, reason: 'malformed' };
  return timingSafeEqual(actual, payload) ? { valid: true } : { valid: false, reason: 'malformed' };
}

/**
 * 把明文算成老格式 hash。**仅用于导入脚本 dry-run 与测试夹具**，
 * 不要用在登录/改密写库路径上 —— 写库一律 scrypt。
 */
export function hashLegacyPassword(plaintext: string): string {
  const authCode = resolveLegacyAuthCode();
  if (!authCode) throw new Error('LEGACY_AUTHCODE 未配置，无法生成历史格式密码');
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new TypeError('plaintext must be a non-empty string');
  }
  return '###' + doubleMd5(authCode, plaintext);
}
