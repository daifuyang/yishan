import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTokenRepository } from '../src/core/repositories/user-token.repository';
import { UserRepository } from '../src/core/repositories/user.repository';
import { AuthService } from '../src/core/services/auth.service';
import { LoginLogService } from '../src/core/services/login-log.service';

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

describe('AuthService password upgrades', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('upgrades a verified legacy hash without changing the login outcome', async () => {
    const legacyHash = await createLegacyHash('Password123!');
    vi.spyOn(UserRepository, 'findAuthIdentityByLogin').mockResolvedValue({
      id: 42,
      username: 'legacy-user',
      email: null,
      realName: 'Legacy User',
      passwordHash: legacyHash,
      status: 1,
      deletedAt: null,
      loginCount: 0,
    });
    const upgrade = vi.spyOn(UserRepository, 'upgradePasswordHash').mockResolvedValue(true);
    vi.spyOn(UserRepository, 'recordSuccessfulLogin').mockResolvedValue();
    vi.spyOn(UserTokenRepository, 'create').mockResolvedValue({} as any);
    vi.spyOn(LoginLogService, 'writeLoginLog').mockResolvedValue({} as any);

    const fastify = {
      jwt: {
        sign: vi.fn().mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token'),
      },
    } as any;

    const result = await AuthService.login(
      { username: 'legacy-user', password: 'Password123!', rememberMe: false },
      fastify,
    );

    expect(result.token).toBe('access-token');
    expect(upgrade).toHaveBeenCalledWith(
      42,
      legacyHash,
      expect.stringMatching(/^\$scrypt\$v=1\$ln=16,r=8,p=2\$/),
    );
  });
});
