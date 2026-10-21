# Tool Renderer Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement task by task.

**Goal:** Replace the parallel progress/result render paths with one typed, deterministic Tool Renderer pipeline.

**Architecture:** UIMessage parts remain the source of truth. A pure adapter deduplicates by call ID, protects terminal states, validates presentation data and redacts details. A local registry resolves trusted overrides, presentation patterns and a generic fallback; every renderer composes the same card. Native forms remain the only business submission path.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Ant Design X, AI SDK 7, Jest.

**Spec:** User attachment `c41bda1b-b410-4aff-9dfc-bacc09647ca3/已粘贴的文本.txt`.

## Constraints

- Do not change business APIs, permissions or native submission/CAS behavior.
- No terminal/diff components without an actual tool consuming them.
- Remove old renderer and name-dispatch paths after migration; no permanent compatibility wrapper.
- No raw secrets in summaries, details or fallback output.
- Preserve unrelated local work; no automatic commits.

## Tasks

- [ ] Audit provider/SSE, result generation, form bridge and renderer call sites.
- [ ] Add failing registry/adapter tests; implement `tools/model.ts`, `registry.ts`, `adapter.ts` and safe data helpers.
- [ ] Extract common ToolCallCard, ToolHeader, ToolStatus and ToolDetails using existing Ant Design controls.
- [ ] Migrate query, native form preview and action results; keep the generic renderer as the unconditional fallback.
- [ ] Integrate the single rendering path into AiChatView and remove obsolete progress/result components and adapters.
- [ ] Verify duplicates, stale terminal updates, parallel calls, cancellation, malformed data, redaction, form recovery and explicit submission boundaries.
- [ ] Run frontend lint/typecheck/tests/build and boundary checks, review changes, restart service and verify in browser.
