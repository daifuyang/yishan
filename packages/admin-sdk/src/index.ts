/**
 * @yishan/admin-sdk — stable admin type surface.
 *
 * WHY THIS PACKAGE EXISTS (AGENTS.md §6, PROPOSAL P1-3):
 * Admin business code used to import the generated ambient `API.*` namespace
 * (apps/yishan-admin/src/services/generated/typings.d.ts) directly. Every
 * OpenAPI field churn then cascaded into handwritten pages as type errors.
 *
 * This package owns a *stable* set of hand-authored types that business code
 * imports instead of `API.*`. They intentionally mirror the current generated
 * shapes, but are decoupled: when the generated types drift, only this one
 * package is reconciled — not every consuming page.
 *
 *   import type { Attachment } from '@yishan/admin-sdk'   // do this
 *   type Attachment = API.sysAttachment                   // not this
 */
export * from './auth.js'
export * from './attachment.js'
export * from './menu.js'
