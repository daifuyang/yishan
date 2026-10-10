import { CustomerService } from './customer.service'
import { CrmAttachmentRepository } from '../repositories/attachment.repository'
import type { SysUserResp } from '@yishan/core-system-api'

export class CrmAttachmentService {
  private readonly customers = new CustomerService()

  async list(customerId: number, user: SysUserResp) {
    await this.customers.detail(customerId, user)
    return CrmAttachmentRepository.list(customerId)
  }

  async create(input: Parameters<typeof CrmAttachmentRepository.create>[0], user: SysUserResp) {
    await this.customers.detail(input.customerId, user)
    return CrmAttachmentRepository.create({ ...input, creatorId: user.id })
  }

  async remove(id: number, user: SysUserResp) {
    const row = await CrmAttachmentRepository.find(id)
    if (row) {
      await this.customers.detail(row.customerId, user)
      await CrmAttachmentRepository.remove(row.id, row.customerId)
    }
  }
}
