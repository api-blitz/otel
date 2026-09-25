---
"@api-blitz/otel-autumn": minor
---

Support the latest `autumn-js` (1.3.x, tested against 1.3.19) while keeping pre-1.0 and 1.2.x behavior unchanged.

- Wrap the new top-level `trackTokens` (model id + token counts) and `batchTrack` (batch size, uniform customer/feature) methods.
- Wrap the new billing flows: `billing.createSchedule`, `billing.multiUpdate`, `billing.previewMultiUpdate`, `billing.import`.
- Wrap `customers.get`, `customers.advanceTestClock`, `entities.list`, and the referral-program CRUD (`referrals.createProgram` / `listPrograms` / `getProgram` / `updateProgram` / `deleteProgram`).
- Instrument the new `invoices.*`, `licenses.*`, `rewards.*`, `keys.*`, `logs.*`, `platform.*`, and `sandboxes.*` sub-resources, each with its own `instrument*` opt-out flag (default on). Credentials in keys/platform/sandbox responses and log search queries are never recorded; reward promo codes are gated behind `captureCustomerData`.
- Map 1.3's cursor pagination (`nextCursor`) to `autumn.has_more`, and emit `autumn.result_count` on list operations.
- Record `overageBehavior`, `async`, and deduction counts on `track`.
- Read positional customer ids on pre-1.0 `customers.*` calls (e.g. `customers.get("cus_123")`).
- Methods and sub-resources missing from the installed `autumn-js` version are still skipped silently; the `autumn-js` peer range is unchanged (`>=0.0.70 <2.0.0`).
