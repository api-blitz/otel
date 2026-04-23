# @kubiks/otel-autumn

OpenTelemetry instrumentation for the [Autumn](https://useautumn.com) billing SDK (`autumn-js`).
Capture spans for every Autumn API call — feature access checks, usage tracking, the full billing lifecycle, customer and entity management, balances, events, plans, features, and referrals — and enrich them with rich billing metadata.

![Autumn Trace Visualization](https://github.com/kubiks-inc/otel/blob/main/images/otel-autumn-trace.png)

_Visualize your billing operations with detailed span information including customer IDs, plan IDs, feature balances, payment flow state, and Stripe invoice data._

## Installation

```bash
npm install @kubiks/otel-autumn
# or
pnpm add @kubiks/otel-autumn
# or
yarn add @kubiks/otel-autumn
# or
bun add @kubiks/otel-autumn
```

**Peer dependencies:** `@opentelemetry/api` >= 1.9.0, `autumn-js` >= 1.0.0 < 2.0.0

## Quick start

```ts
import { Autumn } from "autumn-js";
import { instrumentAutumn } from "@kubiks/otel-autumn";

const autumn = new Autumn({
  secretKey: process.env.AUTUMN_SECRET_KEY!,
});

// Instrument the client — all operations are now traced
instrumentAutumn(autumn);

// Use the SDK normally
await autumn.check({ customerId: "cus_123", featureId: "messages" });
await autumn.billing.attach({ customerId: "cus_123", planId: "pro" });
```

`instrumentAutumn` wraps the Autumn client instance you already use — no configuration changes needed. Every SDK call creates a `CLIENT` span with operation-specific attributes, and the same client instance is returned so instrumentation is idempotent (calling it twice is a no-op).

## What gets traced

The instrumentation wraps every method on the Autumn SDK client — 2 top-level entry points plus 34 sub-resource operations across 8 namespaces.

### Top-level

- **`check`** — feature access checks; optionally atomic check + track via `sendEvent`
- **`track`** — record usage events

### Billing

- `billing.attach` — subscribe / upgrade / downgrade a plan
- `billing.multiAttach` — attach multiple plans in a single Stripe subscription
- `billing.previewAttach` / `billing.previewMultiAttach` — preview charges before confirming
- `billing.update` — update subscriptions, including `cancelAction: 'cancel_immediately' | 'cancel_end_of_cycle' | 'uncancel'`
- `billing.previewUpdate` — preview prorated charges for an update
- `billing.openCustomerPortal` — Stripe billing portal session
- `billing.setupPayment` — payment-method setup session

### Customers

- `customers.getOrCreate`, `list`, `update`, `delete`

### Entities

- `entities.create`, `get`, `update`, `delete` — for per-seat / per-project scoped balances

### Balances

- `balances.create`, `update`, `delete`, `finalize` — manage feature balances and finalize balance locks

### Events

- `events.list` — list raw usage events
- `events.aggregate` — aggregate usage over time periods

### Plans

- `plans.create`, `get`, `list`, `update`, `delete`

### Features

- `features.create`, `get`, `list`, `update`, `delete`

### Referrals

- `referrals.createCode`, `redeemCode`

## Configuration

```ts
import { instrumentAutumn } from "@kubiks/otel-autumn";

instrumentAutumn(autumn, {
  // Custom tracer name (default: "@kubiks/otel-autumn")
  tracerName: "my-app-autumn-tracer",

  // Emit potentially sensitive customer data (payment URLs, portal URLs).
  // The non-sensitive `autumn.has_payment_url` / `autumn.has_portal_url`
  // booleans are always emitted regardless (default: false).
  captureCustomerData: false,

  // Capture plan customization blobs and checkout session params (default: false).
  captureOptions: false,

  // Master switches
  captureResourceIds: true,
  captureRequestAttributes: true,
  captureResponseAttributes: true,

  // Opt out of individual sub-resources
  instrumentBilling: true,
  instrumentCustomers: true,
  instrumentEntities: true,
  instrumentBalances: true,
  instrumentEvents: true,
  instrumentPlans: true,
  instrumentFeatures: true,
  instrumentReferrals: true,
});
```

## Span attributes

Every span includes comprehensive attributes to help with debugging and monitoring.

### Common attributes

| Attribute            | Description                                     | Example             |
| -------------------- | ----------------------------------------------- | ------------------- |
| `billing.system`     | Constant `autumn`                               | `autumn`            |
| `billing.operation`  | Resource-qualified operation name               | `billing.attach`    |
| `autumn.resource`    | Sub-resource (or the operation for flat methods) | `billing`          |
| `autumn.target`      | Full target (same value as `billing.operation`) | `billing.attach`    |
| `autumn.customer_id` | Customer identifier                             | `cus_123`           |
| `autumn.entity_id`   | Entity identifier (when provided)               | `seat_42`           |

### `autumn.check`

| Attribute                 | Description                                        | Example       |
| ------------------------- | -------------------------------------------------- | ------------- |
| `autumn.feature_id`       | Feature being checked                              | `messages`    |
| `autumn.feature_name`     | Feature display name                               | `Messages`    |
| `autumn.feature_type`     | `boolean` / `metered` / `credit_system`            | `metered`     |
| `autumn.allowed`          | Whether access is allowed                          | `true`        |
| `autumn.balance`          | Remaining balance for the feature                  | `42`          |
| `autumn.required_balance` | Minimum balance the check required                 | `3`           |
| `autumn.send_event`       | Whether the check also records a usage event       | `true`        |
| `autumn.with_preview`     | Whether upsell preview was requested               | `false`       |
| `autumn.lock`             | Balance lock id (if reserved)                      | `lock_abc`    |
| `autumn.flag_id`          | Flag id returned by the check                      | `flag_123`    |
| `autumn.plan_id`          | Plan id the flag originates from                   | `pro`         |
| `autumn.has_preview`      | Whether an upsell preview was returned             | `false`       |
| `autumn.plan_scenario`    | Denied-access scenario                             | `usage_limit` |

### `autumn.track`

| Attribute              | Description                                         | Example        |
| ---------------------- | --------------------------------------------------- | -------------- |
| `autumn.feature_id`    | Feature being tracked                               | `messages`     |
| `autumn.event_name`    | Custom event name (when provided)                   | `message_sent` |
| `autumn.value`         | Usage value recorded                                | `1`            |
| `autumn.lock`          | Balance lock id (when provided)                     | `lock_abc`     |
| `autumn.balance`       | Updated remaining balance after the track call      | `41`           |
| `autumn.balance_count` | Number of updated balances when tracking by event   | `3`            |

### `autumn.billing.*`

| Attribute                         | Description                                                               | Example                 |
| --------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| `autumn.plan_id`                  | Plan being attached / updated                                             | `pro`                   |
| `autumn.plan_ids`                 | Comma-joined plan ids on `multiAttach`                                    | `pro,addon_seats`       |
| `autumn.plan_count`               | Number of plans on `multiAttach`                                          | `2`                     |
| `autumn.plan_version`             | Target plan version                                                       | `2`                     |
| `autumn.subscription_id`          | Target subscription (when specified)                                      | `sub_123`               |
| `autumn.cancel_action`            | `cancel_immediately` / `cancel_end_of_cycle` / `uncancel`                 | `cancel_end_of_cycle`   |
| `autumn.carry_over_balances`      | Carry balances into the new plan                                          | `true`                  |
| `autumn.carry_over_usages`        | Carry usages into the new plan                                            | `true`                  |
| `autumn.no_billing_changes`       | Skip billing-side changes for the attach/update                           | `false`                 |
| `autumn.new_billing_subscription` | Create a new Stripe subscription instead of merging                       | `true`                  |
| `autumn.feature_quantities_count` | Number of prepaid features configured                                     | `2`                     |
| `autumn.discount_count`           | Number of discounts applied                                               | `1`                     |
| `autumn.proration_behavior`       | `prorate_immediately` / `none`                                            | `prorate_immediately`   |
| `autumn.redirect_mode`            | `always` / `if_required` / `never`                                        | `if_required`           |
| `autumn.plan_schedule`            | `immediate` / `end_of_cycle`                                              | `immediate`             |
| `autumn.invoice_mode`             | Invoice creation mode                                                     | `draft`                 |
| `autumn.invoice_id`               | Stripe invoice id                                                         | `in_1N...`              |
| `autumn.invoice_status`           | `paid` / `open` / `draft`                                                 | `paid`                  |
| `autumn.total_amount`             | Invoice or preview total (cents)                                          | `2000`                  |
| `autumn.currency`                 | Three-letter ISO currency                                                 | `usd`                   |
| `autumn.has_prorations`           | Whether the preview includes prorations                                   | `true`                  |
| `autumn.has_payment_url`          | Whether a payment URL was returned                                        | `true`                  |
| `autumn.payment_url`              | Stripe payment URL (only when `captureCustomerData: true`)                | `https://checkout.stripe.com/...` |
| `autumn.has_portal_url`           | Whether a portal URL was returned (`openCustomerPortal`)                  | `true`                  |
| `autumn.portal_url`               | Billing portal URL (only when `captureCustomerData: true`)                | `https://billing.stripe.com/...` |
| `autumn.required_action`          | `3ds_required` / `payment_method_required` / `payment_failed`             | `payment_method_required` |

### `autumn.customers.*`, `autumn.entities.*`, `autumn.balances.*`

CRUD operations emit the identifying keys from the request and, when present,
from the response. Notable additions:

- `autumn.entities.create` adds `autumn.entity_feature_id` — distinct from the
  balance-check `autumn.feature_id`.
- `autumn.balances.*` emits `autumn.feature_id`, `autumn.balance` (post-update
  remaining), and `autumn.lock` on `finalize`.

### `autumn.events.*`

| Attribute                | Description                                                            | Example |
| ------------------------ | ---------------------------------------------------------------------- | ------- |
| `autumn.feature_id`      | Feature filter (when provided)                                         | `api`   |
| `autumn.event_name`      | Event-name filter                                                      | `send`  |
| `autumn.aggregate_range` | `aggregate` range value                                                | `7d`    |
| `autumn.event_count`     | Events returned by `list`; summed counts across features on `aggregate` | `42`   |
| `autumn.value`           | Summed value across all features on `aggregate`                        | `1536`  |
| `autumn.period_count`    | Number of time buckets returned by `aggregate`                         | `7`     |
| `autumn.feature_count`   | Number of features in the aggregate totals                             | `2`     |
| `autumn.has_more`        | Whether `list` has more pages available                                | `false` |

### `autumn.plans.*`, `autumn.features.*`

| Attribute             | Description           |
| --------------------- | --------------------- |
| `autumn.plan_id`      | Plan identifier       |
| `autumn.plan_name`    | Plan display name     |
| `autumn.feature_id`   | Feature identifier    |
| `autumn.feature_name` | Feature display name  |
| `autumn.feature_type` | Feature type          |

### `autumn.referrals.*`

| Attribute                    | Description                    |
| ---------------------------- | ------------------------------ |
| `autumn.referral_program_id` | Referral program id            |
| `autumn.referral_code`       | Referral code created/redeemed |

## Usage examples

### Feature access control

```ts
const result = await autumn.check({
  customerId: "cus_123",
  featureId: "messages",
  requiredBalance: 1,
});

if (result.allowed) {
  console.log(`Remaining: ${result.balance?.remaining}`);
}
```

### Atomic check + track

```ts
// Reserve 3 units and record usage in a single call
const result = await autumn.check({
  customerId: "cus_123",
  featureId: "messages",
  requiredBalance: 3,
  sendEvent: true,
});
```

### Usage tracking

```ts
await autumn.track({
  customerId: "cus_123",
  featureId: "messages",
  value: 1,
});
```

### Subscribing a customer to a plan

```ts
const attach = await autumn.billing.attach({
  customerId: "cus_123",
  planId: "pro",
});

if (attach.paymentUrl) {
  // Redirect the user to complete payment
  console.log(`Payment URL: ${attach.paymentUrl}`);
}
```

### Attaching multiple plans at once

```ts
await autumn.billing.multiAttach({
  customerId: "cus_123",
  plans: [
    { planId: "pro" },
    { planId: "addon_seats", featureQuantities: [{ featureId: "seats", quantity: 5 }] },
  ],
});
```

### Cancelling at the end of the billing cycle

```ts
await autumn.billing.update({
  customerId: "cus_123",
  planId: "pro",
  cancelAction: "cancel_end_of_cycle",
});
```

### Opening the Stripe billing portal

```ts
const { url } = await autumn.billing.openCustomerPortal({
  customerId: "cus_123",
});
// Redirect the user to `url`
```

### Listing and aggregating usage events

```ts
// Paginated list of raw events
const events = await autumn.events.list({
  customerId: "cus_123",
  featureId: "messages",
});

// Time-bucketed aggregate
const aggregate = await autumn.events.aggregate({
  customerId: "cus_123",
  featureIds: ["messages"],
  range: "7d",
});
```

### Managing entities (per-seat scoping)

```ts
await autumn.entities.create({
  customerId: "cus_123",
  entityId: "seat_42",
  featureId: "seats",
  name: "Seat 42",
});

// Check a per-seat feature balance
await autumn.check({
  customerId: "cus_123",
  entityId: "seat_42",
  featureId: "api_calls",
});
```

### Error handling

Errors are automatically captured in spans with full exception details and the span status is set to `ERROR`:

```ts
try {
  await autumn.check({ customerId: "unknown", featureId: "messages" });
} catch (error) {
  // The span is already marked as failed with the exception recorded
  console.error("Check failed:", error);
}
```

## Integration with OpenTelemetry

This instrumentation integrates seamlessly with your existing OpenTelemetry setup:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { Autumn } from "autumn-js";
import { instrumentAutumn } from "@kubiks/otel-autumn";

const sdk = new NodeSDK({
  resource: new Resource({ [ATTR_SERVICE_NAME]: "my-app" }),
  traceExporter: new ConsoleSpanExporter(),
});

sdk.start();

const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });
instrumentAutumn(autumn);

// All Autumn operations now appear in your traces
```

## Best practices

1. **Instrument early** — call `instrumentAutumn()` once when initializing your Autumn client, before any API calls.
2. **Reuse clients** — instrument a single Autumn client and reuse it throughout your app.
3. **Context propagation** — the instrumentation automatically propagates OpenTelemetry context so Autumn spans nest correctly under parent HTTP / gRPC / DB spans.
4. **Sensitive data** — `autumn.payment_url` and `autumn.portal_url` are gated behind `captureCustomerData: false` by default. Keep it off unless your trace pipeline is trusted and can handle payment session tokens.
5. **Scope down sub-resources** — if your app only uses the runtime APIs (`check`, `track`, `billing.*`), disable admin sub-resources (`instrumentPlans: false`, `instrumentFeatures: false`) to keep the instrumentation surface minimal.

## Framework integration

### Express

```ts
import express from "express";
import { Autumn } from "autumn-js";
import { instrumentAutumn } from "@kubiks/otel-autumn";

const app = express();
const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });
instrumentAutumn(autumn);

app.post("/messages", async (req, res) => {
  const allowed = await autumn.check({
    customerId: req.auth.userId,
    featureId: "messages",
  });
  if (!allowed.allowed) return res.status(402).send("Quota exceeded");

  // ... send the message ...

  await autumn.track({
    customerId: req.auth.userId,
    featureId: "messages",
    value: 1,
  });
  res.json({ ok: true });
});
```

### Next.js

```ts
// lib/autumn.ts
import { Autumn } from "autumn-js";
import { instrumentAutumn } from "@kubiks/otel-autumn";

const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });
instrumentAutumn(autumn);

export { autumn };
```

```ts
// app/api/messages/route.ts
import { autumn } from "@/lib/autumn";

export async function POST() {
  const allowed = await autumn.check({
    customerId: "cus_123",
    featureId: "messages",
  });
  if (!allowed.allowed) return new Response("Quota exceeded", { status: 402 });

  await autumn.track({
    customerId: "cus_123",
    featureId: "messages",
    value: 1,
  });
  return Response.json({ ok: true });
}
```

### Hono

```ts
import { Hono } from "hono";
import { Autumn } from "autumn-js";
import { instrumentAutumn } from "@kubiks/otel-autumn";

const app = new Hono();
const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });
instrumentAutumn(autumn);

app.post("/messages", async (c) => {
  const allowed = await autumn.check({
    customerId: "cus_123",
    featureId: "messages",
  });
  if (!allowed.allowed) return c.json({ error: "Quota exceeded" }, 402);

  await autumn.track({ customerId: "cus_123", featureId: "messages", value: 1 });
  return c.json({ ok: true });
});
```

## TypeScript support

This package includes full TypeScript definitions. The instrumentation preserves the full type surface of the `Autumn` SDK:

```ts
import { Autumn } from "autumn-js";
import { instrumentAutumn } from "@kubiks/otel-autumn";

const autumn = new Autumn({ secretKey: "..." });
instrumentAutumn(autumn);

// Full type safety is preserved
const result = await autumn.billing.attach({
  customerId: "cus_123",
  planId: "pro",
  cancelAction: "cancel_end_of_cycle", // TypeScript knows valid values
});

// TypeScript error: Property 'invalidMethod' does not exist
// autumn.billing.invalidMethod();
```

All semantic-attribute constants are exported for building custom queries and
dashboards:

```ts
import {
  SEMATTRS_AUTUMN_CUSTOMER_ID,
  SEMATTRS_AUTUMN_PLAN_ID,
  SEMATTRS_AUTUMN_ALLOWED,
  SEMATTRS_BILLING_OPERATION,
} from "@kubiks/otel-autumn";
```

## License

MIT
