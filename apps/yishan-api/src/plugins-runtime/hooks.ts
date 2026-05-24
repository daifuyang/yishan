import { HookEvent, HookHandler } from './types'

type HookPhase = 'pre' | 'main' | 'post'
type HookFailPolicy = 'failOpen' | 'failClose'
type HookHandlerStatus = 'success' | 'error' | 'timeout' | 'skipped'

interface HookRegistrationInternal {
  handler: HookHandler
  priority: number
  phase: HookPhase
  timeoutMs: number
  order: number
  handlerId: string
}

export interface HookOnOptions {
  priority?: number
  phase?: HookPhase
  timeoutMs?: number
  handlerId?: string
}

export interface HookEmitOptions {
  failPolicy?: HookFailPolicy
  timeoutMs?: number
  idempotencyKey?: string
  phase?: HookPhase
  traceId?: string
}

export interface HookHandlerExecutionResult {
  traceId: string
  event: string
  phase: HookPhase
  handlerId: string
  durationMs: number
  status: HookHandlerStatus
  error?: string
}

export interface HookEmitReport {
  traceId: string
  event: string
  phase: HookPhase | 'pipeline'
  failPolicy: HookFailPolicy
  durationMs: number
  shortCircuited: boolean
  idempotencyKey?: string
  status: 'success' | 'error' | 'skipped'
  handlers: HookHandlerExecutionResult[]
}

const DEFAULT_TIMEOUT_MS = 1500
const MAX_TIMEOUT_MS = 10000
const PHASE_ORDER: HookPhase[] = ['pre', 'main', 'post']

export class HookBus {
  private readonly handlers = new Map<string, HookRegistrationInternal[]>()
  private readonly idempotencySuccess = new Set<string>()
  private readonly reports: HookEmitReport[] = []
  private registrationCounter = 0
  private handlerCounter = 0

  on<T = unknown>(name: string, handler: HookHandler<T>, priority?: number): void
  on<T = unknown>(name: string, handler: HookHandler<T>, options?: HookOnOptions): void
  on<T = unknown>(name: string, handler: HookHandler<T>, input?: number | HookOnOptions): void {
    const parsed = this.parseName(name)
    const options: HookOnOptions = typeof input === 'number' ? { priority: input } : (input ?? {})
    const registration: HookRegistrationInternal = {
      handler: handler as HookHandler,
      priority: options.priority ?? 0,
      phase: options.phase ?? parsed.phase,
      timeoutMs: this.clampTimeout(options.timeoutMs),
      order: this.registrationCounter++,
      handlerId: options.handlerId ?? `${parsed.event}#${this.handlerCounter++}`
    }

    const entries = this.handlers.get(parsed.event) ?? []
    entries.push(registration)
    entries.sort((a, b) => b.priority - a.priority || a.order - b.order)
    this.handlers.set(parsed.event, entries)
  }

  async emit<T = unknown>(event: HookEvent<T>, options: HookEmitOptions = {}): Promise<HookEmitReport> {
    const startedAt = Date.now()
    const parsed = this.parseName(event.name)
    const failPolicy = options.failPolicy ?? 'failOpen'
    const traceId = options.traceId ?? this.createTraceId()
    const idempotencyIdentity = options.idempotencyKey ? `${parsed.event}:${options.idempotencyKey}` : undefined

    if (idempotencyIdentity && this.idempotencySuccess.has(idempotencyIdentity)) {
      const skippedReport: HookEmitReport = {
        traceId,
        event: parsed.event,
        phase: options.phase ?? (parsed.phase === 'main' ? 'pipeline' : parsed.phase),
        failPolicy,
        durationMs: Date.now() - startedAt,
        shortCircuited: false,
        idempotencyKey: options.idempotencyKey,
        status: 'skipped',
        handlers: []
      }
      this.storeReport(skippedReport)
      return skippedReport
    }

    const report: HookEmitReport = {
      traceId,
      event: parsed.event,
      phase: options.phase ?? (parsed.phase === 'main' ? 'pipeline' : parsed.phase),
      failPolicy,
      durationMs: 0,
      shortCircuited: false,
      idempotencyKey: options.idempotencyKey,
      status: 'success',
      handlers: []
    }

    const phases = this.resolveEmitPhases(options.phase ?? parsed.phase)
    let eventFailed = false

    for (const phase of phases) {
      const entries = (this.handlers.get(parsed.event) ?? []).filter((item) => item.phase === phase)
      for (const entry of entries) {
        const result = await this.runHandler(entry, {
          name: parsed.event,
          payload: event.payload,
          traceId,
          timeoutMs: this.clampTimeout(options.timeoutMs ?? entry.timeoutMs)
        }, phase)
        report.handlers.push(result)

        if (result.status === 'error' || result.status === 'timeout') {
          eventFailed = true
          report.status = 'error'
          if (failPolicy === 'failClose') {
            report.shortCircuited = true
            report.durationMs = Date.now() - startedAt
            this.storeReport(report)
            throw new Error(`hook execution failed at ${parsed.event}:${phase}:${entry.handlerId} (${result.status})`)
          }
        }
      }
    }

    report.durationMs = Date.now() - startedAt
    if (idempotencyIdentity && !eventFailed) {
      this.idempotencySuccess.add(idempotencyIdentity)
    }
    this.storeReport(report)
    return report
  }

  getExecutionReports(): HookEmitReport[] {
    return [...this.reports]
  }

  private resolveEmitPhases(phase: HookPhase): HookPhase[] {
    if (phase === 'main') {
      return PHASE_ORDER
    }
    return [phase]
  }

  private parseName(name: string): { event: string; phase: HookPhase } {
    const matched = name.match(/^(.*):(pre|main|post)$/)
    if (!matched) {
      return { event: name, phase: 'main' }
    }

    return {
      event: matched[1],
      phase: matched[2] as HookPhase
    }
  }

  private clampTimeout(timeoutMs?: number): number {
    if (timeoutMs == null || Number.isNaN(timeoutMs)) {
      return DEFAULT_TIMEOUT_MS
    }
    return Math.max(1, Math.min(timeoutMs, MAX_TIMEOUT_MS))
  }

  private async runHandler(
    entry: HookRegistrationInternal,
    event: HookEvent & { traceId: string; timeoutMs: number },
    phase: HookPhase
  ): Promise<HookHandlerExecutionResult> {
    const startedAt = Date.now()

    try {
      await this.withTimeout(entry.handler(event), event.timeoutMs)
      return {
        traceId: event.traceId,
        event: event.name,
        phase,
        handlerId: entry.handlerId,
        durationMs: Date.now() - startedAt,
        status: 'success'
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'HOOK_HANDLER_TIMEOUT'
      return {
        traceId: event.traceId,
        event: event.name,
        phase,
        handlerId: entry.handlerId,
        durationMs: Date.now() - startedAt,
        status: isTimeout ? 'timeout' : 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async withTimeout<T>(promise: Promise<T> | T, timeoutMs: number): Promise<T> {
    const normalized = Promise.resolve(promise)
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('HOOK_HANDLER_TIMEOUT'))
      }, timeoutMs)

      normalized
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  private createTraceId(): string {
    return `hook-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  private storeReport(report: HookEmitReport): void {
    this.reports.push(report)
    if (this.reports.length > 200) {
      this.reports.shift()
    }
  }
}
