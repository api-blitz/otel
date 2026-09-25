# @api-blitz/otel-autumn

## 1.2.1

### Patch Changes

- [#9](https://github.com/api-blitz/otel/pull/9) [`4e85a41`](https://github.com/api-blitz/otel/commit/4e85a41e6914a2147f560b1fb7a28d93a2799fbd) Thanks [@ibadus](https://github.com/ibadus)! - Reduce instrumentation work, especially for unsampled spans and large batches.

  - Skip request/response annotation when the span isn't recording (no SDK registered, or sampled out).
  - `batchTrack` finds the shared customer / entity / feature / event name in a single pass with early exit instead of building a `Set` per attribute, so annotating large batches stays cheap.
  - Pass `billing.system`, `billing.operation`, `autumn.resource` and `autumn.target` to `startSpan`, so attribute-based samplers can use them. The recorded attributes are unchanged.

## 1.2.0

### Minor Changes

- [#6](https://github.com/api-blitz/otel/pull/6) [`da4b7c4`](https://github.com/api-blitz/otel/commit/da4b7c4fd029dbfbdd8710b3e67be7c57c490f2f) Thanks [@ibadus](https://github.com/ibadus)! - Support the latest `autumn-js` (1.3.x, tested against 1.3.19) while keeping pre-1.0 and 1.2.x behavior unchanged.

  - Wrap the new top-level `trackTokens` (model id + token counts) and `batchTrack` (batch size, uniform customer/feature) methods.
  - Wrap the new billing flows: `billing.createSchedule`, `billing.multiUpdate`, `billing.previewMultiUpdate`, `billing.import`.
  - Wrap `customers.get`, `customers.advanceTestClock`, `entities.list`, and the referral-program CRUD (`referrals.createProgram` / `listPrograms` / `getProgram` / `updateProgram` / `deleteProgram`).
  - Instrument the new `invoices.*`, `licenses.*`, `rewards.*`, `keys.*`, `logs.*`, `platform.*`, and `sandboxes.*` sub-resources, each with its own `instrument*` opt-out flag (default on). Credentials in keys/platform/sandbox responses and log search queries are never recorded; reward promo codes are gated behind `captureCustomerData`.
  - Map 1.3's cursor pagination (`nextCursor`) to `autumn.has_more`, and emit `autumn.result_count` on list operations.
  - Record `overageBehavior`, `async`, and deduction counts on `track`.
  - Read positional customer ids on pre-1.0 `customers.*` calls (e.g. `customers.get("cus_123")`).
  - Methods and sub-resources missing from the installed `autumn-js` version are still skipped silently; the `autumn-js` peer range is unchanged (`>=0.0.70 <2.0.0`).

## 1.1.0

### Minor Changes

- [#4](https://github.com/api-blitz/otel/pull/4) [`3f2dd12`](https://github.com/api-blitz/otel/commit/3f2dd12edc97e22a59b64847886f090a13ea79ea) Thanks [@ibadus](https://github.com/ibadus)! - Add `autumn-js` pre-1.0 compatibility.

  - Widen `autumn-js` peer range to `>=0.0.70 <2.0.0`.
  - Wrap pre-1.0 flat top-level methods (`attach`, `cancel`, `setupPayment`, `usage`) alongside the existing 1.x sub-resource coverage; methods missing from the installed SDK are skipped silently.
  - Unwrap the pre-1.0 `Result<T, E>` response envelope so response-side span attributes populate the same on both versions.
  - Map `product_id`/`product_ids` to `autumn.plan_id`/`autumn.plan_ids` for dashboard consistency across versions.
