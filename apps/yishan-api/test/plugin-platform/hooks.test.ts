import { describe, expect, it } from 'vitest'
import { HookBus } from '../../src/core/plugin-platform/hooks'

describe('HookBus', () => {
  it('runs handlers by priority descending', async () => {
    const bus = new HookBus()
    const order: string[] = []

    bus.on('event', () => {
      order.push('low')
    }, 1)

    bus.on('event', () => {
      order.push('high')
    }, 10)

    bus.on('event', () => {
      order.push('middle')
    }, 5)

    bus.on('event', () => {
      order.push('high-2')
    }, 10)

    await bus.emit({ name: 'event', payload: {} })
    expect(order).toEqual(['high', 'high-2', 'middle', 'low'])
  })

  it('marks timeout and continues in failOpen mode', async () => {
    const bus = new HookBus()
    const order: string[] = []

    bus.on('event', async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      order.push('slow')
    }, { timeoutMs: 5 })

    bus.on('event', () => {
      order.push('next')
    }, { priority: -1 })

    const report = await bus.emit({ name: 'event', payload: {} }, { failPolicy: 'failOpen' })

    expect(order).toEqual(['next'])
    expect(report.handlers[0].status).toBe('timeout')
    expect(report.handlers[1].status).toBe('success')
    expect(report.shortCircuited).toBe(false)
  })

  it('continues after errors in failOpen mode', async () => {
    const bus = new HookBus()
    const order: string[] = []

    bus.on('event', () => {
      order.push('first')
      throw new Error('boom')
    }, 10)

    bus.on('event', () => {
      order.push('second')
    }, 1)

    const report = await bus.emit({ name: 'event', payload: {} }, { failPolicy: 'failOpen' })

    expect(order).toEqual(['first', 'second'])
    expect(report.handlers[0].status).toBe('error')
    expect(report.handlers[1].status).toBe('success')
  })

  it('stops execution in failClose mode', async () => {
    const bus = new HookBus()
    const order: string[] = []

    bus.on('event', () => {
      order.push('first')
      throw new Error('boom')
    }, 10)

    bus.on('event', () => {
      order.push('second')
    }, 1)

    await expect(bus.emit({ name: 'event', payload: {} }, { failPolicy: 'failClose' })).rejects.toThrow(
      'hook execution failed'
    )
    expect(order).toEqual(['first'])
  })

  it('deduplicates successful events by idempotencyKey', async () => {
    const bus = new HookBus()
    let called = 0

    bus.on('event', () => {
      called += 1
    })

    const first = await bus.emit({ name: 'event', payload: {} }, { idempotencyKey: 'same-key' })
    const second = await bus.emit({ name: 'event', payload: {} }, { idempotencyKey: 'same-key' })

    expect(called).toBe(1)
    expect(first.status).toBe('success')
    expect(second.status).toBe('skipped')
  })

  it('runs phase pipeline in pre-main-post order', async () => {
    const bus = new HookBus()
    const order: string[] = []

    bus.on('event', () => {
      order.push('main')
    }, { phase: 'main' })

    bus.on('event:post', () => {
      order.push('post')
    })

    bus.on('event', () => {
      order.push('pre')
    }, { phase: 'pre' })

    const report = await bus.emit({ name: 'event', payload: {} })

    expect(order).toEqual(['pre', 'main', 'post'])
    expect(report.phase).toBe('pipeline')
    expect(report.handlers.map((item) => item.phase)).toEqual(['pre', 'main', 'post'])
  })

  it('supports phase-only emit and execution report history', async () => {
    const bus = new HookBus()
    const order: string[] = []

    bus.on('event', () => {
      order.push('pre')
    }, { phase: 'pre' })

    bus.on('event', () => {
      order.push('main')
    }, { phase: 'main' })

    await bus.emit({ name: 'event:pre', payload: {} })

    expect(order).toEqual(['pre'])
    const reports = bus.getExecutionReports()
    expect(reports.length).toBe(1)
    expect(reports[0].handlers[0].traceId).toBe(reports[0].traceId)
  })
})
