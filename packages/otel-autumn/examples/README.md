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

**37 spans total**: 36 successful `CLIENT`-kind spans covering every method on the 1.x client surface, plus one `autumn.check` span with `otel.status_code=ERROR`.

The demo runs with `captureCustomerData: true` so `autumn.payment_url` and `autumn.portal_url` are populated (they're redacted by default — the unit tests cover the redacted case).

### Top-level (2 spans)

| Span | Key attributes |
|---|---|
| `autumn.check` | `autumn.allowed=true`, `autumn.balance=42`, `autumn.feature_id=messages`, `autumn.plan_id=pro`, `autumn.flag_id=flag_demo`, `autumn.has_preview=true` |
| `autumn.track` | `autumn.event_name=message_sent`, `autumn.value=1`, `autumn.balance=41`, `autumn.balance_count=2` |

### billing (8 spans)

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

### customers (4 spans)

`autumn.customers.getOrCreate`, `.list`, `.update`, `.delete` — each carries `autumn.customer_id=cus_demo`.

### entities (4 spans)

`autumn.entities.create`, `.get`, `.update`, `.delete` — each carries `autumn.entity_id=seat_demo` and `autumn.entity_feature_id=seats`.

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

### referrals (2 spans)

`autumn.referrals.createCode`, `autumn.referrals.redeemCode` — each carries `autumn.referral_code=REF123` and `autumn.referral_program_id=prog_demo`.

### Error path (1 span)

A second `autumn.check` span with `otel.status_code=ERROR`, `error=true`, and an `exception` event with message `demo: feature not found`.

## Quick Jaeger API checks

After running the demo, these commands validate the trace set programmatically:

```bash
# 36 unique operation names expected
curl -s 'http://localhost:16686/api/services/otel-autumn-demo/operations' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])"

# 37 spans total (36 successes + 1 error)
curl -s 'http://localhost:16686/api/traces?service=otel-autumn-demo&limit=200' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(len(t['spans']) for t in d['data']))"
```

## Notes

- The demo uses a **plain-object mock** of the `autumn-js` client (same pattern as the unit tests), so no Autumn API key or network access is required.
- Pre-1.0 `autumn-js` (0.0.x) top-level methods (`attach`, `cancel`, `setupPayment`, `usage`) are instrumented but only wrap if the method exists on the client — they're absent from a 1.x shape, so the demo doesn't exercise them. The unit tests cover that compatibility surface.
- Spans are pushed via `BatchSpanProcessor`; the demo explicitly calls `forceFlush()` and `shutdown()` before exit so nothing is dropped.
- OTLP endpoint defaults to `http://localhost:4318`; override with `OTEL_EXPORTER_OTLP_ENDPOINT` if Jaeger runs elsewhere.
