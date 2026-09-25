# otel-autumn trace playground

Replays **every** instrumented Autumn method through `instrumentAutumn` and exports the spans via OTLP/HTTP to a local Jaeger. Use this to visually verify that the instrumentation covers the full SDK surface with the expected span names and attributes.

## Run it

From the repo root:

```bash
docker compose up -d                                 # starts Jaeger on :16686 and :4318
pnpm --filter @api-blitz/otel-autumn install         # first time only
pnpm --filter @api-blitz/otel-autumn example
```

Then open <http://localhost:16686>, pick **Service** `otel-autumn-demo`, and click **Find Traces**.

When finished:

```bash
docker compose down
```

## What you should see

**79 spans total**: 78 successful `CLIENT`-kind spans covering every method on the latest 1.x client surface (autumn-js 1.3.x), plus one `autumn.check` span with `otel.status_code=ERROR`.

The demo runs with `captureCustomerData: true` so `autumn.payment_url` and `autumn.portal_url` are populated (they're redacted by default — the unit tests cover the redacted case).

### Top-level (4 spans)

| Span | Key attributes |
|---|---|
| `autumn.check` | `autumn.allowed=true`, `autumn.balance=42`, `autumn.feature_id=messages`, `autumn.plan_id=pro`, `autumn.flag_id=flag_demo`, `autumn.has_preview=true` |
| `autumn.track` | `autumn.event_name=message_sent`, `autumn.value=1`, `autumn.balance=41`, `autumn.balance_count=2` |
| `autumn.trackTokens` | `autumn.model_id=anthropic/claude-opus-4-8`, `autumn.input_tokens=1200`, `autumn.output_tokens=340`, `autumn.cache_read_tokens=800`, `autumn.reasoning_tokens=50`, `autumn.value=12.5`, `autumn.deduction_count=1` |
| `autumn.batchTrack` | `autumn.batch_size=2`, `autumn.customer_id=cus_demo`, `autumn.success=true` |

### billing (12 spans)

| Span | Key attributes |
|---|---|
| `autumn.billing.attach` | `autumn.plan_id=pro`, `autumn.plan_version=2`, `autumn.invoice_mode=true`, `autumn.feature_quantities_count=2`, `autumn.discount_count=1`, `autumn.has_payment_url=true`, `autumn.invoice_id=in_demo`, `autumn.currency=usd`, `autumn.total_amount=2000` |
| `autumn.billing.multiAttach` | `autumn.plan_ids=pro,addon_seats`, `autumn.plan_count=2` |
| `autumn.billing.previewAttach` | `autumn.total_amount=2000`, `autumn.has_prorations=true` |
| `autumn.billing.previewMultiAttach` | `autumn.total_amount=5000`, `autumn.has_prorations=false` |
| `autumn.billing.update` | `autumn.cancel_action=cancel_end_of_cycle`, `autumn.proration_behavior=none`, `autumn.plan_version=3` |
| `autumn.billing.previewUpdate` | `autumn.total_amount=1000`, `autumn.has_prorations=true` |
| `autumn.billing.openCustomerPortal` | `autumn.has_portal_url=true`, `autumn.portal_url=https://billing.stripe.com/...` |
| `autumn.billing.setupPayment` | `autumn.has_payment_url=true`, `autumn.payment_url=https://checkout.stripe.com/setup/...` |
| `autumn.billing.multiUpdate` | `autumn.update_count=2`, `autumn.plan_ids=pro,addon_seats` |
| `autumn.billing.previewMultiUpdate` | `autumn.total_amount=750`, `autumn.currency=usd` |
| `autumn.billing.createSchedule` | `autumn.phase_count=2`, `autumn.plan_ids=starter,pro,addon_seats`, `autumn.billing_behavior=prorate_immediately`, `autumn.schedule_id=sched_demo`, `autumn.schedule_status=created` |
| `autumn.billing.import` | `autumn.billable_count=1`, `autumn.dry_run=true`, `autumn.import_count=1` |

### customers (6 spans)

`autumn.customers.getOrCreate`, `.get`, `.list`, `.update`, `.delete`, `.advanceTestClock` — each non-`list` span carries `autumn.customer_id=cus_demo`; `list` carries `autumn.result_count=2` and `autumn.has_more=false`; `advanceTestClock` adds `autumn.frozen_time` and `autumn.test_clock_status=advancing`.

### entities (5 spans)

`autumn.entities.create`, `.get`, `.list`, `.update`, `.delete` — each non-`list` span carries `autumn.entity_id=seat_demo` and `autumn.entity_feature_id=seats`.

### balances (4 spans)

`autumn.balances.create`, `.update`, `.delete`, `.finalize` — each carries `autumn.feature_id=messages` and `autumn.balance` (the remaining value from the response).

### events (2 spans)

| Span | Key attributes |
|---|---|
| `autumn.events.list` | `autumn.event_count=3`, `autumn.has_more=false` |
| `autumn.events.aggregate` | `autumn.aggregate_range=7d`, `autumn.feature_count=2`, `autumn.period_count=2`, `autumn.event_count=7` (sum), `autumn.value=1578` (sum) |

### plans (5 spans)

`autumn.plans.create`, `.get`, `.list`, `.update`, `.delete` — each non-`list` span carries `autumn.plan_id=pro` and `autumn.plan_name`.

### features (5 spans)

`autumn.features.create`, `.get`, `.list`, `.update`, `.delete` — each non-`list` span carries `autumn.feature_id=messages`, `autumn.feature_name`, `autumn.feature_type=metered`.

### referrals (7 spans)

`autumn.referrals.createCode`, `autumn.referrals.redeemCode` — each carries `autumn.referral_code=REF123` and `autumn.referral_program_id=prog_demo`. The program CRUD spans (`createProgram`, `listPrograms`, `getProgram`, `updateProgram`, `deleteProgram`) carry `autumn.referral_program_id=prog_demo` and `autumn.reward_id=rew_demo`.

### invoices (7 spans)

| Span | Key attributes |
|---|---|
| `autumn.invoices.create` | `autumn.invoice_autumn_id=inv_demo`, `autumn.invoice_id=in_demo_3`, `autumn.invoice_status=open`, `autumn.total_amount=4200`, `autumn.plan_ids=pro` |
| `autumn.invoices.insert` | `autumn.result_count=2` |
| `autumn.invoices.list` / `.listTemplates` | `autumn.result_count`, `autumn.has_more=false` |
| `autumn.invoices.pay` / `.void` | `autumn.invoice_autumn_id=inv_demo`, `autumn.invoice_status=paid` / `void` |
| `autumn.invoices.reissue` | `autumn.is_preview=true`, `autumn.total_amount=3900` |

### licenses (2 spans)

`autumn.licenses.attach` / `.release` — `autumn.plan_id=team`, `autumn.entity_count`, `autumn.success=true`.

### rewards (6 spans)

`autumn.rewards.create`, `.list`, `.get`, `.update`, `.delete`, `.redeemCode` — `autumn.reward_id`, `autumn.reward_type=coupon`, `autumn.result_count=2` on `list`, `autumn.entitlement_count=1` on `redeemCode`. Because the demo sets `captureCustomerData: true`, `redeemCode` also carries `autumn.reward_code=SAVE50`.

### keys, logs, platform, sandboxes (13 spans)

`autumn.keys.mint` / `.refresh` / `.revoke`, `autumn.logs.search` (`autumn.result_count=2`), `autumn.platform.*` (`autumn.organization_slug=acme`, `autumn.env=sandbox`, `autumn.connected=true` on `getStripeConnection`), and `autumn.sandboxes.*` (`autumn.sandbox_id=sbx_demo`, `autumn.sandbox_name=QA`). Access/refresh tokens, OAuth URLs/tokens, sandbox secret keys, and log search queries are never recorded, even with `captureCustomerData: true`.

### Error path (1 span)

A second `autumn.check` span with `otel.status_code=ERROR`, `error=true`, and an `exception` event with message `demo: feature not found`.

## Quick Jaeger API checks

After running the demo, these commands validate the trace set programmatically:

```bash
# 78 unique operation names expected
curl -s 'http://localhost:16686/api/services/otel-autumn-demo/operations' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])"

# 79 spans total (78 successes + 1 error)
curl -s 'http://localhost:16686/api/traces?service=otel-autumn-demo&limit=200' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(len(t['spans']) for t in d['data']))"
```

## Notes

- The demo uses a **plain-object mock** of the `autumn-js` client (same pattern as the unit tests), so no Autumn API key or network access is required.
- Pre-1.0 `autumn-js` (0.0.x) top-level methods (`attach`, `cancel`, `setupPayment`, `usage`) are instrumented but only wrap if the method exists on the client — they're absent from a 1.x shape, so the demo doesn't exercise them. The unit tests cover that compatibility surface.
- Spans are pushed via `BatchSpanProcessor`; the demo explicitly calls `forceFlush()` and `shutdown()` before exit so nothing is dropped.
- OTLP endpoint defaults to `http://localhost:4318`; override with `OTEL_EXPORTER_OTLP_ENDPOINT` if Jaeger runs elsewhere.
