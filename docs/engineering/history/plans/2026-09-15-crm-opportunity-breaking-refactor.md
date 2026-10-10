# CRM Opportunity Breaking Refactor Implementation Plan

**Goal:** Replace the transitional Opportunity model with one canonical sales-opportunity model and its product-intent relation.

**Architecture:** The database, repository, service, request contracts, and admin client use the same names: `stage`, `amountCents`, `primaryContactId`, `ownerId`, `lostReason`. Product intent is a normal join table. The service owns transactional mutations and customer lifecycle/activity side effects.

**Tech Stack:** Fastify, TypeBox, Drizzle/MySQL, React, Ant Design Pro, Vitest.

## Tasks

- [ ] Add failing service tests for product-intent persistence, stage-derived probability, transactional lifecycle, and activity metadata.
- [ ] Replace Opportunity schema fields and add `crm_opportunity_product_intent` migration/table/repository methods.
- [ ] Replace Opportunity request/response contracts and service mutations; remove pipeline and scope semantics.
- [ ] Update lifecycle so a won opportunity marks the customer won without a contract.
- [ ] Update admin CRM types, create form, compact list, and activity display to the canonical contract.
- [ ] Remove stale references and run focused tests, type checks, build, and smoke checks.
