import { FastifyRequest, FastifyReply } from 'fastify';
import { BusinessError } from '../../exceptions/business-error.js';
import { AuthErrorCode } from '../../constants/business-codes/auth.js';

const ADMIN_ROLE_IDS = [1, 2];

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const currentUser = request.currentUser;
  const roleIds = currentUser?.roleIds ?? [];

  const isAdmin = roleIds.some((roleId: number) => ADMIN_ROLE_IDS.includes(roleId));

  if (!isAdmin) {
    throw new BusinessError(
      AuthErrorCode.FORBIDDEN,
      '需要管理员权限才能访问此接口'
    );
  }
}
