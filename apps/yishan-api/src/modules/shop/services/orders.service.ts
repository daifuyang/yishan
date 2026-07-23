import type { AppQueryDb } from '@/db'
import {
  OrdersRepository,
  type CreateOrderInput,
  type OrderListQuery,
  type UpdateOrderInput,
} from '../repositories/orders.repository.js'

export class OrdersService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: OrderListQuery) {
    const { rows, total } = await OrdersRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }
  async findById(id: number) {
    const order = await OrdersRepository.findById(id, this.db)
    if (!order) throw new Error('Order not found')
    const items = await OrdersRepository.listItems(id, this.db)
    return { ...order, items }
  }
  async create(input: CreateOrderInput) {
    const existed = await OrdersRepository.findByOrderNo(input.orderNo, this.db)
    if (existed) throw new Error('Order number already exists')
    return OrdersRepository.create(input, this.db)
  }
  async update(id: number, input: UpdateOrderInput) {
    const existed = await OrdersRepository.findById(id, this.db)
    if (!existed) throw new Error('Order not found')
    const updated = await OrdersRepository.update(id, input, this.db)
    if (!updated) throw new Error('Order not found')
    return updated
  }
  async remove(id: number): Promise<void> {
    const existed = await OrdersRepository.findById(id, this.db)
    if (!existed) throw new Error('Order not found')
    await OrdersRepository.softDelete(id, this.db)
  }
  async listItems(orderId: number) {
    return OrdersRepository.listItems(orderId, this.db)
  }
}
