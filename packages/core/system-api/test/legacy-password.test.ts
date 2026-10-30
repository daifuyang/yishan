/**
 * 历史密码格式兼容层（ThinkCMF 5.x）的回归测试。
 *
 * 这里有两类断言，目的完全不同：
 *
 *   1. 正确性 —— 老库里的真实 hash 必须能校验通过。夹具用的是从线上
 *      iximei 库回扫出来的三组真实 `###` 值，算法一旦偏移就会立刻报错。
 *   2. 隔离性 —— scrypt 校验器（`verifyPassword` / `comparePassword`）
 *      **绝不能**认出 `###` 格式。否则任何拿到历史 hash 的人都能绕过
 *      登录直接改密，等于把整个老库的弱算法变成全局后门。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PASSWORD_FORMAT_LEGACY,
  PASSWORD_FORMAT_SCRYPT_V1,
  hashLegacyPassword,
  isLegacyPasswordSupported,
  parseThinkCmfLegacyHash,
  resolveLegacyAuthCode,
  verifyLegacyPassword,
} from '../src/utils/legacy-password.js'
import { comparePassword, hashPassword, verifyPassword } from '../src/utils/password.js'

const REAL_AUTH_CODE = 'U02r3D6dXAuB90BbFG'

/** 线上老库回扫出来的真实组合：明文 → `###` + md5(md5(authcode + 明文))。 */
const REAL_LEGACY_HASHES = [
  ['111111', '###8f1ef4e8b75a8e47a3e6e38dedd1d6a5'],
  ['123456', '###88bd5c8cc2467de916aecb251325ab6e'],
  ['abc123456', '###5161d8f3514ce21928c5bb8027f6fa8d'],
] as const

const originalAuthCode = process.env.LEGACY_AUTHCODE
const originalAlias = process.env.LEGACY_IXIMEI_AUTHCODE

beforeEach(() => {
  process.env.LEGACY_AUTHCODE = REAL_AUTH_CODE
  delete process.env.LEGACY_IXIMEI_AUTHCODE
})

afterEach(() => {
  if (originalAuthCode === undefined) delete process.env.LEGACY_AUTHCODE
  else process.env.LEGACY_AUTHCODE = originalAuthCode
  if (originalAlias === undefined) delete process.env.LEGACY_IXIMEI_AUTHCODE
  else process.env.LEGACY_IXIMEI_AUTHCODE = originalAlias
})

describe('legacy password format constants', () => {
  it('keeps the persisted enum values stable', () => {
    // 这两个数字写进了 sys_user.password_format 的存量数据，改了就是全量数据错位。
    expect(PASSWORD_FORMAT_LEGACY).toBe(0)
    expect(PASSWORD_FORMAT_SCRYPT_V1).toBe(1)
  })
})

describe('authcode resolution', () => {
  it('reads LEGACY_AUTHCODE', () => {
    expect(resolveLegacyAuthCode()).toBe(REAL_AUTH_CODE)
    expect(isLegacyPasswordSupported()).toBe(true)
  })

  it('falls back to the historical LEGACY_IXIMEI_AUTHCODE name', () => {
    delete process.env.LEGACY_AUTHCODE
    process.env.LEGACY_IXIMEI_AUTHCODE = REAL_AUTH_CODE
    expect(resolveLegacyAuthCode()).toBe(REAL_AUTH_CODE)
  })

  it('treats a blank value as unconfigured rather than empty-string matching', () => {
    process.env.LEGACY_AUTHCODE = '   '
    expect(resolveLegacyAuthCode()).toBeNull()
    expect(isLegacyPasswordSupported()).toBe(false)
  })
})

describe('verifyLegacyPassword', () => {
  it.each(REAL_LEGACY_HASHES)('accepts the real historical hash for %s', (plaintext, hash) => {
    expect(verifyLegacyPassword(plaintext, hash)).toEqual({ valid: true })
  })

  it.each(REAL_LEGACY_HASHES)('rejects a wrong password against the hash of %s', (_plaintext, hash) => {
    expect(verifyLegacyPassword('definitely-not-it', hash).valid).toBe(false)
  })

  it('rejects malformed hashes instead of guessing a format', () => {
    for (const hash of ['', '###', '###xyz', 'md5$abcdef', null, undefined, 42, '##8f1ef4e8b75a8e47a3e6e38dedd1d6a5']) {
      expect(verifyLegacyPassword('111111', hash)).toEqual({ valid: false, reason: 'malformed' })
    }
  })

  it('rejects an empty plaintext', () => {
    expect(verifyLegacyPassword('', REAL_LEGACY_HASHES[0][1])).toEqual({ valid: false, reason: 'empty' })
  })

  it('refuses to verify anything when the authcode is missing', () => {
    delete process.env.LEGACY_AUTHCODE
    // 关键：未配置时**不能**退化成「任意密码通过」，也不能退回空 authcode 计算。
    expect(verifyLegacyPassword('111111', REAL_LEGACY_HASHES[0][1])).toEqual({
      valid: false,
      reason: 'authcode_missing',
    })
  })

  it('rejects the correct password when a different authcode is configured', () => {
    process.env.LEGACY_AUTHCODE = 'some-other-deployment-authcode'
    expect(verifyLegacyPassword('111111', REAL_LEGACY_HASHES[0][1]).valid).toBe(false)
  })
})

describe('parseThinkCmfLegacyHash', () => {
  it('extracts the 32 hex payload', () => {
    const payload = parseThinkCmfLegacyHash(REAL_LEGACY_HASHES[0][1])
    expect(payload).toHaveLength(16)
    expect(payload!.toString('hex')).toBe('8f1ef4e8b75a8e47a3e6e38dedd1d6a5')
  })

  it('returns null for non-legacy shapes', () => {
    expect(parseThinkCmfLegacyHash('$scrypt$v=1$ln=16,r=8,p=2$abc$def')).toBeNull()
    expect(parseThinkCmfLegacyHash('###8f1ef4e8b75a8e47a3e6e38dedd1d6a')).toBeNull()
  })
})

describe('hashLegacyPassword', () => {
  it.each(REAL_LEGACY_HASHES)('reproduces the known hash for %s', (plaintext, hash) => {
    expect(hashLegacyPassword(plaintext)).toBe(hash)
  })

  it('refuses to mint a legacy hash without an authcode', () => {
    delete process.env.LEGACY_AUTHCODE
    expect(() => hashLegacyPassword('111111')).toThrow(/LEGACY_AUTHCODE/)
  })

  it('rejects an empty plaintext', () => {
    expect(() => hashLegacyPassword('')).toThrow(TypeError)
  })
})

describe('scrypt verifier isolation', () => {
  it('does not recognise the legacy `###` format at all', async () => {
    for (const [, hash] of REAL_LEGACY_HASHES) {
      // 这是本设计最重要的一条：历史格式只能走显式的 verifyLegacyPassword。
      await expect(verifyPassword('111111', hash)).resolves.toEqual({ valid: false, needsRehash: false })
      await expect(comparePassword('111111', hash)).resolves.toBe(false)
    }
  })

  it('still verifies its own scrypt hashes', async () => {
    const hash = await hashPassword('111111')
    expect(hash.startsWith('$scrypt$v=1$')).toBe(true)
    await expect(verifyPassword('111111', hash)).resolves.toEqual({ valid: true, needsRehash: false })
    await expect(verifyPassword('111112', hash)).resolves.toEqual({ valid: false, needsRehash: false })
  })
})
