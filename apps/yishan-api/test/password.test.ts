import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword, verifyPassword } from '../src/utils/password';

const scryptAsync = promisify(scrypt);

async function createLegacyHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 32, {
    cost: 2 ** 16,
    blockSize: 8,
    parallelization: 2,
    maxmem: 128 * 2 ** 16 * 8 * 2,
  });
  return `${salt.toString('hex')}.${Buffer.from(key).toString('hex')}`;
}

describe('password hashing', () => {
  it('stores new passwords in a self-describing scrypt format', async () => {
    const hash = await hashPassword('Password123!');

    expect(hash).toMatch(/^\$scrypt\$v=1\$ln=16,r=8,p=2\$/);
    await expect(comparePassword('Password123!', hash)).resolves.toBe(true);
    await expect(comparePassword('incorrect', hash)).resolves.toBe(false);
  });

  it('accepts a valid legacy hash once and marks it for upgrade', async () => {
    const hash = await createLegacyHash('Password123!');

    await expect(verifyPassword('Password123!', hash)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it('rejects malformed hashes without throwing', async () => {
    await expect(verifyPassword('Password123!', 'not-a-password-hash')).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});
