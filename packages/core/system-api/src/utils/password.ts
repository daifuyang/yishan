/**
 * Password hashing utilities.
 *
 * New hashes use a versioned, self-describing scrypt format. The legacy
 * `salt.hash` format remains verifiable so users can be upgraded on login.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_COST = 2 ** 16;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 2;
const SCRYPT_LOG_N = 16;
const SCRYPT_MAX_MEMORY = 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2;

export interface PasswordVerification {
  valid: boolean;
  needsRehash: boolean;
}

interface ScryptParameters {
  cost: number;
  blockSize: number;
  parallelization: number;
}

const currentScryptParameters: ScryptParameters = {
  cost: SCRYPT_COST,
  blockSize: SCRYPT_BLOCK_SIZE,
  parallelization: SCRYPT_PARALLELIZATION,
};

function deriveScryptKey(
  password: string,
  salt: Buffer,
  parameters: ScryptParameters = currentScryptParameters,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        cost: parameters.cost,
        blockSize: parameters.blockSize,
        parallelization: parameters.parallelization,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

function isExpectedBuffer(value: Buffer, length: number): boolean {
  return value.length === length;
}

function isValidHex(value: string, bytes: number): boolean {
  return new RegExp(`^[0-9a-f]{${bytes * 2}}$`, 'i').test(value);
}

function parseVersionedScryptHash(hash: string) {
  const parts = hash.split('$');
  if (parts.length !== 6 || parts[0] !== '' || parts[1] !== 'scrypt' || parts[2] !== 'v=1') {
    return null;
  }

  const parameterEntries = parts[3].split(',').map((entry) => entry.split('='));
  if (parameterEntries.length !== 3 || parameterEntries.some(([key, value]) => !key || !value)) {
    return null;
  }
  const parameters = Object.fromEntries(parameterEntries);
  if (Object.keys(parameters).length !== 3) return null;

  const logN = Number(parameters.ln);
  const blockSize = Number(parameters.r);
  const parallelization = Number(parameters.p);
  if (
    logN !== SCRYPT_LOG_N ||
    blockSize !== SCRYPT_BLOCK_SIZE ||
    parallelization !== SCRYPT_PARALLELIZATION
  ) {
    return null;
  }

  const salt = Buffer.from(parts[4], 'base64url');
  const expectedKey = Buffer.from(parts[5], 'base64url');
  if (!isExpectedBuffer(salt, SCRYPT_SALT_LENGTH) || !isExpectedBuffer(expectedKey, SCRYPT_KEY_LENGTH)) {
    return null;
  }

  return { salt, expectedKey, parameters: currentScryptParameters };
}

function parseLegacyScryptHash(hash: string) {
  const parts = hash.split('.');
  if (parts.length !== 2 || !isValidHex(parts[0], SCRYPT_SALT_LENGTH) || !isValidHex(parts[1], SCRYPT_KEY_LENGTH)) {
    return null;
  }

  return {
    salt: Buffer.from(parts[0], 'hex'),
    expectedKey: Buffer.from(parts[1], 'hex'),
    parameters: currentScryptParameters,
  };
}

/**
 * Hash a password using the current versioned scrypt format.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const key = await deriveScryptKey(password, salt);
  return `$scrypt$v=1$ln=${SCRYPT_LOG_N},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELIZATION}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/**
 * Verify a password and report whether a valid legacy hash should be upgraded.
 */
export async function verifyPassword(password: string, hash: string): Promise<PasswordVerification> {
  if (!hash || typeof hash !== 'string') return { valid: false, needsRehash: false };

  const versioned = parseVersionedScryptHash(hash);
  const legacy = versioned ? null : parseLegacyScryptHash(hash);
  const parsed = versioned ?? legacy;
  if (!parsed) return { valid: false, needsRehash: false };

  try {
    const actualKey = await deriveScryptKey(password, parsed.salt, parsed.parameters);
    const valid = actualKey.length === parsed.expectedKey.length && timingSafeEqual(actualKey, parsed.expectedKey);
    return { valid, needsRehash: valid && Boolean(legacy) };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

/**
 * Backwards-compatible boolean verifier for existing callers.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return (await verifyPassword(password, hash)).valid;
}
