/**
 * 密码加密工具函数
 * 使用与 passwordManager 相同的 scrypt 算法
 */

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEYLEN = 32;
const SCRYPT_COST = 65536;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 2;
const SCRYPT_MAXMEM = 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2;

/**
 * 密码加密
 * @param password 明文密码
 * @returns 加密后的密码哈希 (格式: salt.hash)
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(Math.min(16, SCRYPT_KEYLEN / 2));

    scrypt(password, salt, SCRYPT_KEYLEN, {
      cost: SCRYPT_COST,
      blockSize: SCRYPT_BLOCK_SIZE,
      parallelization: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAXMEM
    }, function (error, key) {
      if (error !== null) {
        reject(error);
      } else {
        resolve(`${salt.toString('hex')}.${key.toString('hex')}`);
      }
    });
  });
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hash 存储的密码哈希
 * @returns 是否匹配
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // 检查 hash 是否为 null 或 undefined
  if (!hash || typeof hash !== 'string') {
    return false;
  }
  
  const parts = hash.split('.');
  if (parts.length !== 2) {
    return false;
  }
  
  const [salt, hashed] = parts;
  const saltBuffer = Buffer.from(salt, 'hex');
  const hashedBuffer = Buffer.from(hashed, 'hex');

  return new Promise((resolve) => {
    scrypt(password, saltBuffer, SCRYPT_KEYLEN, {
      cost: SCRYPT_COST,
      blockSize: SCRYPT_BLOCK_SIZE,
      parallelization: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAXMEM
    }, function (error, key) {
      if (error !== null) {
        timingSafeEqual(hashedBuffer, hashedBuffer);
        resolve(false);
      } else {
        resolve(timingSafeEqual(key, hashedBuffer));
      }
    });
  });
}