# AI single-model settings implementation plan

> Execute using subagent-driven-development, with focused tests and final review.

**Goal:** Configure one Anthropic-compatible model from Admin. Database configuration takes precedence over environment fallback. API keys are write-only.

**Architecture:** AI owns ai_model_settings, repository, service, TypeBox endpoints and Admin page. No generic system-option access to credentials. Stored key is retained for empty edits. No model catalog or routing. Configuration errors never silently switch providers.

- [x] Add singleton table/migration, typed config schemas, repository and service. Test DB precedence, absent-record fallback, incomplete settings, blank-key retention and no secret in public response.
- [ ] Load one resolved configuration per chat request and pass it into runtime without globals. Preserve old environment-only runtime test entry points. Add independently permissioned GET/PUT settings and POST test-connection endpoints; never expose upstream errors or key.
- [ ] Add AI settings menu contribution and installed frontend registry page. Generate OpenAPI clients. Page uses password input with no returned key, blank means retain; saves and tests display useful feedback.
- [ ] Run focused tests, typechecks, boundaries, lint and builds. Apply migration only to verified local development target if necessary; document production migration/menu sync. Browser verify settings state, save, blank key behavior and access. Review before handoff.

API contract: GET /api/ai/v1/settings -> {baseUrl,model,hasApiKey,source:'database'|'environment'|'unconfigured'}. PUT same nonsecret fields plus optional apiKey; requires model and stored/new key, retaining key when omitted/empty. POST /api/ai/v1/settings/test tests the saved effective configuration, returning {ok,message}. Permissions ai:settings:read and ai:settings:update; test requires update. API key is never included in GET/PUT response or logs. Base URL defaults to Anthropic /v1 when omitted, supports HTTP localhost for self-hosted gateway, rejects credentials/query/hash in URL.

Ruling: user explicitly removed enabled switch. A database row always takes precedence; only an absent row allows environment fallback. Menu uses a Robot icon mapped to the existing Lucide system.
