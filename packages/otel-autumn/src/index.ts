import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import type { Autumn } from "autumn-js";

const DEFAULT_TRACER_NAME = "@api-blitz/otel-autumn";
const INSTRUMENTED_FLAG = Symbol("apiBlitzOtelAutumnInstrumented");

// Common semantic attributes
export const SEMATTRS_BILLING_SYSTEM = "billing.system" as const;
export const SEMATTRS_BILLING_OPERATION = "billing.operation" as const;
export const SEMATTRS_AUTUMN_RESOURCE = "autumn.resource" as const;
export const SEMATTRS_AUTUMN_TARGET = "autumn.target" as const;

// Identity attributes
export const SEMATTRS_AUTUMN_CUSTOMER_ID = "autumn.customer_id" as const;
export const SEMATTRS_AUTUMN_ENTITY_ID = "autumn.entity_id" as const;
export const SEMATTRS_AUTUMN_ENTITY_FEATURE_ID = "autumn.entity_feature_id" as const;
export const SEMATTRS_AUTUMN_SUBSCRIPTION_ID = "autumn.subscription_id" as const;

// Plan attributes (v1 rename from product_*)
export const SEMATTRS_AUTUMN_PLAN_ID = "autumn.plan_id" as const;
export const SEMATTRS_AUTUMN_PLAN_IDS = "autumn.plan_ids" as const;
export const SEMATTRS_AUTUMN_PLAN_NAME = "autumn.plan_name" as const;
export const SEMATTRS_AUTUMN_PLAN_SCENARIO = "autumn.plan_scenario" as const;

// Feature attributes
export const SEMATTRS_AUTUMN_FEATURE_ID = "autumn.feature_id" as const;
export const SEMATTRS_AUTUMN_FEATURE_NAME = "autumn.feature_name" as const;
export const SEMATTRS_AUTUMN_FEATURE_TYPE = "autumn.feature_type" as const;

// Check attributes
export const SEMATTRS_AUTUMN_ALLOWED = "autumn.allowed" as const;
export const SEMATTRS_AUTUMN_BALANCE = "autumn.balance" as const;
export const SEMATTRS_AUTUMN_REQUIRED_BALANCE = "autumn.required_balance" as const;
export const SEMATTRS_AUTUMN_SEND_EVENT = "autumn.send_event" as const;
export const SEMATTRS_AUTUMN_WITH_PREVIEW = "autumn.with_preview" as const;
export const SEMATTRS_AUTUMN_LOCK = "autumn.lock" as const;
export const SEMATTRS_AUTUMN_FLAG_ID = "autumn.flag_id" as const;
export const SEMATTRS_AUTUMN_HAS_PREVIEW = "autumn.has_preview" as const;

// Track attributes
export const SEMATTRS_AUTUMN_EVENT_NAME = "autumn.event_name" as const;
export const SEMATTRS_AUTUMN_VALUE = "autumn.value" as const;
export const SEMATTRS_AUTUMN_BALANCE_COUNT = "autumn.balance_count" as const;
export const SEMATTRS_AUTUMN_OVERAGE_BEHAVIOR = "autumn.overage_behavior" as const;
export const SEMATTRS_AUTUMN_ASYNC = "autumn.async" as const;
export const SEMATTRS_AUTUMN_DEDUCTION_COUNT = "autumn.deduction_count" as const;
export const SEMATTRS_AUTUMN_BATCH_SIZE = "autumn.batch_size" as const;

// Token-tracking attributes (`trackTokens`, autumn-js >= 1.2.x)
export const SEMATTRS_AUTUMN_MODEL_ID = "autumn.model_id" as const;
export const SEMATTRS_AUTUMN_INPUT_TOKENS = "autumn.input_tokens" as const;
export const SEMATTRS_AUTUMN_OUTPUT_TOKENS = "autumn.output_tokens" as const;
export const SEMATTRS_AUTUMN_CACHE_READ_TOKENS = "autumn.cache_read_tokens" as const;
export const SEMATTRS_AUTUMN_CACHE_WRITE_TOKENS = "autumn.cache_write_tokens" as const;
export const SEMATTRS_AUTUMN_REASONING_TOKENS = "autumn.reasoning_tokens" as const;
export const SEMATTRS_AUTUMN_AUDIO_INPUT_TOKENS = "autumn.audio_input_tokens" as const;
export const SEMATTRS_AUTUMN_AUDIO_OUTPUT_TOKENS = "autumn.audio_output_tokens" as const;

// Billing attributes
export const SEMATTRS_AUTUMN_INVOICE = "autumn.invoice" as const;
export const SEMATTRS_AUTUMN_INVOICE_ID = "autumn.invoice_id" as const;
export const SEMATTRS_AUTUMN_INVOICE_MODE = "autumn.invoice_mode" as const;
export const SEMATTRS_AUTUMN_INVOICE_STATUS = "autumn.invoice_status" as const;
export const SEMATTRS_AUTUMN_CURRENCY = "autumn.currency" as const;
export const SEMATTRS_AUTUMN_TOTAL_AMOUNT = "autumn.total_amount" as const;
export const SEMATTRS_AUTUMN_HAS_PRORATIONS = "autumn.has_prorations" as const;
export const SEMATTRS_AUTUMN_PAYMENT_URL = "autumn.payment_url" as const;
export const SEMATTRS_AUTUMN_HAS_PAYMENT_URL = "autumn.has_payment_url" as const;
export const SEMATTRS_AUTUMN_PORTAL_URL = "autumn.portal_url" as const;
export const SEMATTRS_AUTUMN_HAS_PORTAL_URL = "autumn.has_portal_url" as const;
export const SEMATTRS_AUTUMN_REQUIRED_ACTION = "autumn.required_action" as const;
export const SEMATTRS_AUTUMN_CANCEL_ACTION = "autumn.cancel_action" as const;
export const SEMATTRS_AUTUMN_CARRY_OVER_BALANCES = "autumn.carry_over_balances" as const;
export const SEMATTRS_AUTUMN_CARRY_OVER_USAGES = "autumn.carry_over_usages" as const;
export const SEMATTRS_AUTUMN_PRORATION_BEHAVIOR = "autumn.proration_behavior" as const;
export const SEMATTRS_AUTUMN_REDIRECT_MODE = "autumn.redirect_mode" as const;
export const SEMATTRS_AUTUMN_PLAN_SCHEDULE = "autumn.plan_schedule" as const;
export const SEMATTRS_AUTUMN_PLAN_COUNT = "autumn.plan_count" as const;
export const SEMATTRS_AUTUMN_FEATURE_QUANTITIES_COUNT = "autumn.feature_quantities_count" as const;
export const SEMATTRS_AUTUMN_DISCOUNT_COUNT = "autumn.discount_count" as const;
export const SEMATTRS_AUTUMN_NO_BILLING_CHANGES = "autumn.no_billing_changes" as const;
export const SEMATTRS_AUTUMN_NEW_BILLING_SUBSCRIPTION = "autumn.new_billing_subscription" as const;
export const SEMATTRS_AUTUMN_PLAN_VERSION = "autumn.plan_version" as const;
export const SEMATTRS_AUTUMN_BILLING_BEHAVIOR = "autumn.billing_behavior" as const;
export const SEMATTRS_AUTUMN_SCHEDULE_ID = "autumn.schedule_id" as const;
export const SEMATTRS_AUTUMN_SCHEDULE_STATUS = "autumn.schedule_status" as const;
export const SEMATTRS_AUTUMN_PHASE_COUNT = "autumn.phase_count" as const;
export const SEMATTRS_AUTUMN_UPDATE_COUNT = "autumn.update_count" as const;
export const SEMATTRS_AUTUMN_BILLABLE_COUNT = "autumn.billable_count" as const;
export const SEMATTRS_AUTUMN_IMPORT_COUNT = "autumn.import_count" as const;
export const SEMATTRS_AUTUMN_DRY_RUN = "autumn.dry_run" as const;

// Invoice attributes (`invoices.*`, autumn-js >= 1.2.x). `autumn.invoice_id`
// stays the processor (Stripe) id for parity with `billing.*` spans; the
// Autumn-side id that `invoices.pay/void/reissue` take lives here instead.
export const SEMATTRS_AUTUMN_INVOICE_AUTUMN_ID = "autumn.invoice_autumn_id" as const;
export const SEMATTRS_AUTUMN_IS_PREVIEW = "autumn.is_preview" as const;

// Events attributes
export const SEMATTRS_AUTUMN_EVENT_COUNT = "autumn.event_count" as const;
export const SEMATTRS_AUTUMN_PERIOD_COUNT = "autumn.period_count" as const;
export const SEMATTRS_AUTUMN_AGGREGATE_RANGE = "autumn.aggregate_range" as const;

// List attributes
export const SEMATTRS_AUTUMN_RESULT_COUNT = "autumn.result_count" as const;
export const SEMATTRS_AUTUMN_HAS_MORE = "autumn.has_more" as const;

// Customer attributes
export const SEMATTRS_AUTUMN_FROZEN_TIME = "autumn.frozen_time" as const;
export const SEMATTRS_AUTUMN_TEST_CLOCK_STATUS = "autumn.test_clock_status" as const;

// Referral attributes
export const SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID = "autumn.referral_program_id" as const;
export const SEMATTRS_AUTUMN_REFERRAL_CODE = "autumn.referral_code" as const;

// Reward attributes (`rewards.*`, autumn-js >= 1.2.x)
export const SEMATTRS_AUTUMN_REWARD_ID = "autumn.reward_id" as const;
export const SEMATTRS_AUTUMN_REWARD_TYPE = "autumn.reward_type" as const;
export const SEMATTRS_AUTUMN_REWARD_CODE = "autumn.reward_code" as const;
export const SEMATTRS_AUTUMN_ENTITLEMENT_COUNT = "autumn.entitlement_count" as const;

// License attributes (`licenses.*`, autumn-js >= 1.2.x)
export const SEMATTRS_AUTUMN_ENTITY_COUNT = "autumn.entity_count" as const;
export const SEMATTRS_AUTUMN_SUCCESS = "autumn.success" as const;

// Platform / sandbox attributes (autumn-js >= 1.2.x)
export const SEMATTRS_AUTUMN_ORGANIZATION_SLUG = "autumn.organization_slug" as const;
export const SEMATTRS_AUTUMN_ENV = "autumn.env" as const;
export const SEMATTRS_AUTUMN_CONNECTED = "autumn.connected" as const;
export const SEMATTRS_AUTUMN_SANDBOX_ID = "autumn.sandbox_id" as const;
export const SEMATTRS_AUTUMN_SANDBOX_NAME = "autumn.sandbox_name" as const;

/**
 * Configuration for Autumn instrumentation.
 */
export interface InstrumentAutumnConfig {
  /** Tracer name; defaults to "@api-blitz/otel-autumn". */
  tracerName?: string;
  /**
   * Capture potentially sensitive customer fields (email, name, payment URLs,
   * customer-portal URLs).
   * @default false
   */
  captureCustomerData?: boolean;
  /**
   * Capture request-side attributes on spans.
   * @default true
   */
  captureRequestAttributes?: boolean;
  /**
   * Capture response-side attributes on spans.
   * @default true
   */
  captureResponseAttributes?: boolean;
  /** Instrument `autumn.billing.*`. @default true */
  instrumentBilling?: boolean;
  /** Instrument `autumn.customers.*`. @default true */
  instrumentCustomers?: boolean;
  /** Instrument `autumn.entities.*`. @default true */
  instrumentEntities?: boolean;
  /** Instrument `autumn.balances.*`. @default true */
  instrumentBalances?: boolean;
  /** Instrument `autumn.events.*`. @default true */
  instrumentEvents?: boolean;
  /** Instrument `autumn.plans.*`. @default true */
  instrumentPlans?: boolean;
  /** Instrument `autumn.features.*`. @default true */
  instrumentFeatures?: boolean;
  /** Instrument `autumn.referrals.*`. @default true */
  instrumentReferrals?: boolean;
  /** Instrument `autumn.invoices.*` (autumn-js >= 1.2.x). @default true */
  instrumentInvoices?: boolean;
  /** Instrument `autumn.licenses.*` (autumn-js >= 1.2.x). @default true */
  instrumentLicenses?: boolean;
  /** Instrument `autumn.rewards.*` (autumn-js >= 1.2.x). @default true */
  instrumentRewards?: boolean;
  /** Instrument `autumn.keys.*` (autumn-js >= 1.2.x). @default true */
  instrumentKeys?: boolean;
  /** Instrument `autumn.logs.*` (autumn-js >= 1.3.x). @default true */
  instrumentLogs?: boolean;
  /** Instrument `autumn.platform.*` (autumn-js >= 1.2.x). @default true */
  instrumentPlatform?: boolean;
  /** Instrument `autumn.sandboxes.*` (autumn-js >= 1.3.x). @default true */
  instrumentSandboxes?: boolean;
}

/**
 * @deprecated Use {@link InstrumentAutumnConfig}. Kept as a soft alias for
 * consumers migrating from v1.x.
 */
export type InstrumentationConfig = InstrumentAutumnConfig;

interface InstrumentedFlagged {
  [INSTRUMENTED_FLAG]?: true;
}

type AnyRecord = Record<string, unknown>;
type AnyAsync = (...args: unknown[]) => Promise<unknown>;
type Annotator<T = unknown> = (span: Span, value: T, config: InstrumentAutumnConfig) => void;

function finalizeSpan(span: Span, error?: unknown): void {
  if (error) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({ code: SpanStatusCode.ERROR });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

function setIfString(span: Span, key: string, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    span.setAttribute(key, value);
  }
}

function setIfNumber(span: Span, key: string, value: unknown): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    span.setAttribute(key, value);
  }
}

function setIfBoolean(span: Span, key: string, value: unknown): void {
  if (typeof value === "boolean") {
    span.setAttribute(key, value);
  }
}

function isObject(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null;
}

function readEnabled(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (isObject(value) && typeof value.enabled === "boolean") return value.enabled;
  return undefined;
}

// Pre-1.0 autumn-js wraps responses as Result<T, E> = { data, error }. The
// 1.x SDK returns bare payloads. Unwrap only the success branch so response
// annotators see the same shape on both versions; 1.x values pass through
// unchanged because they don't carry a `data`/`error` pair.
function unwrapResult(value: unknown): unknown {
  if (!isObject(value)) return value;
  if ("data" in value && "error" in value && value.data != null) {
    return value.data;
  }
  return value;
}

function extractPlanIds(plans: unknown): string[] | undefined {
  if (!Array.isArray(plans)) return undefined;
  const ids = plans
    .map((plan) => (isObject(plan) && typeof plan.planId === "string" ? plan.planId : undefined))
    .filter((id): id is string => typeof id === "string");
  return ids.length > 0 ? ids : undefined;
}

function setPlanIds(span: Span, ids: string[] | undefined): void {
  if (!ids || ids.length === 0) return;
  span.setAttribute(SEMATTRS_AUTUMN_PLAN_IDS, ids.join(","));
  span.setAttribute(SEMATTRS_AUTUMN_PLAN_COUNT, ids.length);
}

function setIfArrayLength(span: Span, key: string, value: unknown): void {
  if (Array.isArray(value)) {
    span.setAttribute(key, value.length);
  }
}

// Pagination moved from offset (`hasMore`, pre-1.0 `has_more`) to cursors
// (`nextCursor`) in autumn-js 1.3; derive the same boolean from any of them.
function readHasMore(res: AnyRecord): boolean | undefined {
  if (typeof res.hasMore === "boolean") return res.hasMore;
  if (typeof res.has_more === "boolean") return res.has_more;
  if ("nextCursor" in res) return typeof res.nextCursor === "string" && res.nextCursor.length > 0;
  return undefined;
}

// ---------- Top-level annotators ----------

const annotateCheckRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId ?? req.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId ?? req.feature_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId ?? req.entity_id);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId ?? req.product_id);
  setIfNumber(span, SEMATTRS_AUTUMN_REQUIRED_BALANCE, req.requiredBalance ?? req.required_balance);
  setIfBoolean(span, SEMATTRS_AUTUMN_SEND_EVENT, req.sendEvent ?? req.send_event);
  setIfBoolean(span, SEMATTRS_AUTUMN_WITH_PREVIEW, req.withPreview ?? req.with_preview);
  if (isObject(req.lock)) {
    setIfString(span, SEMATTRS_AUTUMN_LOCK, req.lock.lockId);
  }
};

const annotateCheckResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfBoolean(span, SEMATTRS_AUTUMN_ALLOWED, res.allowed);
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.entityId ?? res.entity_id);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.featureId ?? res.feature_id);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, res.planId ?? res.product_id);
  setIfNumber(span, SEMATTRS_AUTUMN_REQUIRED_BALANCE, res.requiredBalance ?? res.required_balance);
  if (isObject(res.balance)) {
    setIfNumber(span, SEMATTRS_AUTUMN_BALANCE, res.balance.remaining);
    setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.balance.featureId ?? res.balance.feature_id);
    if (isObject(res.balance.feature)) {
      setIfString(span, SEMATTRS_AUTUMN_FEATURE_NAME, res.balance.feature.name);
      setIfString(span, SEMATTRS_AUTUMN_FEATURE_TYPE, res.balance.feature.type);
    }
  }
  if (isObject(res.flag)) {
    setIfString(span, SEMATTRS_AUTUMN_FLAG_ID, res.flag.id);
    setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, res.flag.planId ?? res.flag.product_id);
  }
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PREVIEW, Boolean(res.preview));
  if (isObject(res.preview)) {
    setIfString(span, SEMATTRS_AUTUMN_PLAN_SCENARIO, res.preview.scenario);
  }
};

const annotateTrackRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId ?? req.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId ?? req.feature_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId ?? req.entity_id);
  setIfString(span, SEMATTRS_AUTUMN_EVENT_NAME, req.eventName ?? req.event_name);
  setIfNumber(span, SEMATTRS_AUTUMN_VALUE, req.value);
  setIfString(span, SEMATTRS_AUTUMN_OVERAGE_BEHAVIOR, req.overageBehavior);
  setIfBoolean(span, SEMATTRS_AUTUMN_ASYNC, req.async);
  if (isObject(req.lock)) {
    setIfString(span, SEMATTRS_AUTUMN_LOCK, req.lock.lockId);
  }
};

const annotateTrackResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.entityId ?? res.entity_id);
  setIfString(span, SEMATTRS_AUTUMN_EVENT_NAME, res.eventName ?? res.event_name);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.featureId ?? res.feature_id);
  setIfNumber(span, SEMATTRS_AUTUMN_VALUE, res.value);
  if (isObject(res.balance)) {
    setIfNumber(span, SEMATTRS_AUTUMN_BALANCE, res.balance.remaining);
    setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.balance.featureId ?? res.balance.feature_id);
  }
  if (isObject(res.balances)) {
    span.setAttribute(SEMATTRS_AUTUMN_BALANCE_COUNT, Object.keys(res.balances).length);
  }
  setIfArrayLength(span, SEMATTRS_AUTUMN_DEDUCTION_COUNT, res.deductions);
};

const annotateTrackTokensRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId);
  setIfString(span, SEMATTRS_AUTUMN_MODEL_ID, req.modelId);
  setIfNumber(span, SEMATTRS_AUTUMN_INPUT_TOKENS, req.inputTokens);
  setIfNumber(span, SEMATTRS_AUTUMN_OUTPUT_TOKENS, req.outputTokens);
  setIfNumber(span, SEMATTRS_AUTUMN_CACHE_READ_TOKENS, req.cacheReadTokens);
  setIfNumber(span, SEMATTRS_AUTUMN_CACHE_WRITE_TOKENS, req.cacheWriteTokens);
  setIfNumber(span, SEMATTRS_AUTUMN_REASONING_TOKENS, req.reasoningTokens);
  setIfNumber(span, SEMATTRS_AUTUMN_AUDIO_INPUT_TOKENS, req.audioInputTokens);
  setIfNumber(span, SEMATTRS_AUTUMN_AUDIO_OUTPUT_TOKENS, req.audioOutputTokens);
  setIfString(span, SEMATTRS_AUTUMN_OVERAGE_BEHAVIOR, req.overageBehavior);
  setIfBoolean(span, SEMATTRS_AUTUMN_ASYNC, req.async);
};

// batchTrack takes an array of track payloads. Identity attributes are only
// emitted when every event in the batch shares the same value.
const annotateBatchTrackRequest: Annotator = (span, req) => {
  if (!Array.isArray(req)) return;
  span.setAttribute(SEMATTRS_AUTUMN_BATCH_SIZE, req.length);
  const uniform = (key: string): unknown => {
    const values = new Set(req.map((event) => (isObject(event) ? event[key] : undefined)));
    return values.size === 1 ? [...values][0] : undefined;
  };
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, uniform("customerId"));
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, uniform("entityId"));
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, uniform("featureId"));
  setIfString(span, SEMATTRS_AUTUMN_EVENT_NAME, uniform("eventName"));
};

const annotateSuccessResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfBoolean(span, SEMATTRS_AUTUMN_SUCCESS, res.success);
};

// ---------- Billing annotators ----------

const annotateAttachRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId ?? req.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId ?? req.entity_id);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId ?? req.product_id);
  setIfString(span, SEMATTRS_AUTUMN_SUBSCRIPTION_ID, req.subscriptionId);
  setIfBoolean(span, SEMATTRS_AUTUMN_INVOICE_MODE, readEnabled(req.invoiceMode));
  setIfString(span, SEMATTRS_AUTUMN_PRORATION_BEHAVIOR, req.prorationBehavior);
  setIfString(span, SEMATTRS_AUTUMN_REDIRECT_MODE, req.redirectMode);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_SCHEDULE, req.planSchedule);
  setIfBoolean(span, SEMATTRS_AUTUMN_CARRY_OVER_BALANCES, readEnabled(req.carryOverBalances));
  setIfBoolean(span, SEMATTRS_AUTUMN_CARRY_OVER_USAGES, readEnabled(req.carryOverUsages));
  setIfBoolean(span, SEMATTRS_AUTUMN_NO_BILLING_CHANGES, req.noBillingChanges);
  setIfBoolean(span, SEMATTRS_AUTUMN_NEW_BILLING_SUBSCRIPTION, req.newBillingSubscription);
  setIfNumber(span, SEMATTRS_AUTUMN_PLAN_VERSION, req.version);
  if (Array.isArray(req.featureQuantities)) {
    span.setAttribute(SEMATTRS_AUTUMN_FEATURE_QUANTITIES_COUNT, req.featureQuantities.length);
  }
  if (Array.isArray(req.discounts)) {
    span.setAttribute(SEMATTRS_AUTUMN_DISCOUNT_COUNT, req.discounts.length);
  }
  if (Array.isArray(req.product_ids)) {
    const ids = req.product_ids.filter((id): id is string => typeof id === "string");
    if (ids.length > 0) {
      span.setAttribute(SEMATTRS_AUTUMN_PLAN_IDS, ids.join(","));
      span.setAttribute(SEMATTRS_AUTUMN_PLAN_COUNT, ids.length);
    }
  }
};

const annotateMultiAttachRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfBoolean(span, SEMATTRS_AUTUMN_INVOICE_MODE, readEnabled(req.invoiceMode));
  setIfString(span, SEMATTRS_AUTUMN_REDIRECT_MODE, req.redirectMode);
  setIfBoolean(span, SEMATTRS_AUTUMN_NEW_BILLING_SUBSCRIPTION, req.newBillingSubscription);
  setIfString(span, SEMATTRS_AUTUMN_BILLING_BEHAVIOR, req.billingBehavior);
  const ids = extractPlanIds(req.plans);
  if (ids) {
    span.setAttribute(SEMATTRS_AUTUMN_PLAN_IDS, ids.join(","));
    span.setAttribute(SEMATTRS_AUTUMN_PLAN_COUNT, ids.length);
  } else if (Array.isArray(req.plans)) {
    span.setAttribute(SEMATTRS_AUTUMN_PLAN_COUNT, req.plans.length);
  }
  if (Array.isArray(req.discounts)) {
    span.setAttribute(SEMATTRS_AUTUMN_DISCOUNT_COUNT, req.discounts.length);
  }
};

const annotateUpdateRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId);
  setIfString(span, SEMATTRS_AUTUMN_SUBSCRIPTION_ID, req.subscriptionId);
  setIfString(span, SEMATTRS_AUTUMN_CANCEL_ACTION, req.cancelAction);
  setIfBoolean(span, SEMATTRS_AUTUMN_INVOICE_MODE, readEnabled(req.invoiceMode));
  setIfString(span, SEMATTRS_AUTUMN_PRORATION_BEHAVIOR, req.prorationBehavior);
  setIfBoolean(span, SEMATTRS_AUTUMN_NO_BILLING_CHANGES, req.noBillingChanges);
  setIfNumber(span, SEMATTRS_AUTUMN_PLAN_VERSION, req.version);
  if (Array.isArray(req.featureQuantities)) {
    span.setAttribute(SEMATTRS_AUTUMN_FEATURE_QUANTITIES_COUNT, req.featureQuantities.length);
  }
};

const annotateCreateScheduleRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfBoolean(span, SEMATTRS_AUTUMN_INVOICE_MODE, readEnabled(req.invoiceMode));
  setIfString(span, SEMATTRS_AUTUMN_REDIRECT_MODE, req.redirectMode);
  setIfString(span, SEMATTRS_AUTUMN_BILLING_BEHAVIOR, req.billingBehavior);
  setIfBoolean(span, SEMATTRS_AUTUMN_NO_BILLING_CHANGES, req.noBillingChanges);
  setIfArrayLength(span, SEMATTRS_AUTUMN_DISCOUNT_COUNT, req.discounts);
  if (Array.isArray(req.phases)) {
    span.setAttribute(SEMATTRS_AUTUMN_PHASE_COUNT, req.phases.length);
    const phasePlans = req.phases.flatMap((phase) => (isObject(phase) && Array.isArray(phase.plans) ? phase.plans : []));
    const ids = extractPlanIds(phasePlans);
    setPlanIds(span, ids ? [...new Set(ids)] : undefined);
  }
};

const annotateMultiUpdateRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfArrayLength(span, SEMATTRS_AUTUMN_UPDATE_COUNT, req.updates);
  setPlanIds(span, extractPlanIds(req.updates));
};

const annotateImportRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfArrayLength(span, SEMATTRS_AUTUMN_BILLABLE_COUNT, req.billables);
  setIfBoolean(span, SEMATTRS_AUTUMN_DRY_RUN, req.dryRun);
};

const annotateImportResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfArrayLength(span, SEMATTRS_AUTUMN_IMPORT_COUNT, res.flashed);
};

const annotateBillingCustomerRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId ?? req.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId ?? req.entity_id);
};

const annotateAttachResponse: Annotator = (span, res, config) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.entityId ?? res.entity_id);
  if (isObject(res.invoice)) {
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_ID, res.invoice.stripeId);
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_STATUS, res.invoice.status);
    setIfNumber(span, SEMATTRS_AUTUMN_TOTAL_AMOUNT, res.invoice.total);
    setIfString(span, SEMATTRS_AUTUMN_CURRENCY, res.invoice.currency);
  }
  // 1.x uses `paymentUrl`; pre-1.0 uses `checkout_url`. Both map to the
  // same payment-url semantics, gated behind captureCustomerData.
  const paymentUrl = typeof res.paymentUrl === "string" && res.paymentUrl.length > 0
    ? res.paymentUrl
    : typeof res.checkout_url === "string" && res.checkout_url.length > 0
      ? res.checkout_url
      : undefined;
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PAYMENT_URL, Boolean(paymentUrl));
  if (paymentUrl && config.captureCustomerData) {
    span.setAttribute(SEMATTRS_AUTUMN_PAYMENT_URL, paymentUrl);
  }
  if (isObject(res.requiredAction)) {
    setIfString(span, SEMATTRS_AUTUMN_REQUIRED_ACTION, res.requiredAction.code);
  }
  // Pre-1.0 AttachResult carries an array of product_ids; surface as plan_ids.
  if (Array.isArray(res.product_ids)) {
    const ids = res.product_ids.filter((id): id is string => typeof id === "string");
    if (ids.length > 0) {
      span.setAttribute(SEMATTRS_AUTUMN_PLAN_IDS, ids.join(","));
      span.setAttribute(SEMATTRS_AUTUMN_PLAN_COUNT, ids.length);
    }
  }
};

const annotateCreateScheduleResponse: Annotator = (span, res, config) => {
  annotateAttachResponse(span, res, config);
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_SCHEDULE_ID, res.scheduleId);
  setIfString(span, SEMATTRS_AUTUMN_SCHEDULE_STATUS, res.status);
  setIfArrayLength(span, SEMATTRS_AUTUMN_PHASE_COUNT, res.phases);
};

const annotatePreviewResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfString(span, SEMATTRS_AUTUMN_CURRENCY, res.currency);
  setIfNumber(span, SEMATTRS_AUTUMN_TOTAL_AMOUNT, res.total);
  setIfBoolean(span, SEMATTRS_AUTUMN_HAS_PRORATIONS, res.hasProrations);
};

const annotatePortalResponse: Annotator = (span, res, config) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  const url = typeof res.url === "string" ? res.url : undefined;
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PORTAL_URL, Boolean(url));
  if (url && config.captureCustomerData) {
    span.setAttribute(SEMATTRS_AUTUMN_PORTAL_URL, url);
  }
};

const annotateSetupPaymentResponse: Annotator = (span, res, config) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  const url = typeof res.url === "string" ? res.url : undefined;
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PAYMENT_URL, Boolean(url));
  if (url && config.captureCustomerData) {
    span.setAttribute(SEMATTRS_AUTUMN_PAYMENT_URL, url);
  }
};

// ---------- Pre-1.0 flat-method annotators ----------

const annotateCancelRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId ?? req.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId ?? req.entity_id);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId ?? req.product_id);
  if (typeof req.cancel_immediately === "boolean") {
    span.setAttribute(
      SEMATTRS_AUTUMN_CANCEL_ACTION,
      req.cancel_immediately ? "cancel_immediately" : "cancel_end_of_cycle",
    );
  }
};

const annotateCancelResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, res.planId ?? res.product_id);
};

const annotateUsageRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId ?? req.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId ?? req.feature_id);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId ?? req.entity_id);
  setIfNumber(span, SEMATTRS_AUTUMN_VALUE, req.value);
};

const annotateUsageResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId ?? res.customer_id);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.featureId ?? res.feature_id);
};

// ---------- Customers annotators ----------

const annotateCustomerRequest: Annotator = (span, req) => {
  // Pre-1.0 customer methods take the id positionally, e.g. `customers.get("cus_1")`.
  if (typeof req === "string") {
    setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req);
    return;
  }
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.id ?? req.customerId);
};

const annotateCustomerResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.id ?? res.customerId);
};

const annotateAdvanceTestClockRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfNumber(span, SEMATTRS_AUTUMN_FROZEN_TIME, req.frozenTime);
};

const annotateAdvanceTestClockResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfNumber(span, SEMATTRS_AUTUMN_FROZEN_TIME, res.frozenTime);
  setIfString(span, SEMATTRS_AUTUMN_TEST_CLOCK_STATUS, res.status);
};

// ---------- Entities annotators ----------

const annotateEntityRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_FEATURE_ID, req.featureId);
};

const annotateEntityResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.id ?? res.entityId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_FEATURE_ID, res.featureId);
};

// ---------- Balances annotators ----------

const annotateBalanceRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId);
  setIfString(span, SEMATTRS_AUTUMN_LOCK, req.lockId);
  setIfNumber(span, SEMATTRS_AUTUMN_VALUE, req.value);
};

const annotateBalanceResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.featureId);
  setIfNumber(span, SEMATTRS_AUTUMN_BALANCE, res.remaining ?? res.balance);
  setIfBoolean(span, SEMATTRS_AUTUMN_SUCCESS, res.success);
};

// ---------- Events annotators ----------

const annotateEventsListRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId);
  setIfString(span, SEMATTRS_AUTUMN_EVENT_NAME, req.eventName);
};

const annotateEventsAggregateRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_AGGREGATE_RANGE, req.range);
};

const annotateEventsListResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  if (Array.isArray(res.list)) {
    span.setAttribute(SEMATTRS_AUTUMN_EVENT_COUNT, res.list.length);
  }
  setIfBoolean(span, SEMATTRS_AUTUMN_HAS_MORE, readHasMore(res));
};

const annotateEventsAggregateResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  if (Array.isArray(res.list)) {
    span.setAttribute(SEMATTRS_AUTUMN_PERIOD_COUNT, res.list.length);
  }
  if (isObject(res.total)) {
    const features = Object.keys(res.total);
    span.setAttribute("autumn.feature_count", features.length);
    // Sum counts across all features for a single headline metric
    let totalCount = 0;
    let totalSum = 0;
    for (const featureId of features) {
      const entry = res.total[featureId];
      if (isObject(entry)) {
        if (typeof entry.count === "number") totalCount += entry.count;
        if (typeof entry.sum === "number") totalSum += entry.sum;
      }
    }
    span.setAttribute(SEMATTRS_AUTUMN_EVENT_COUNT, totalCount);
    span.setAttribute(SEMATTRS_AUTUMN_VALUE, totalSum);
  }
};

// ---------- Plans annotators ----------

const annotatePlanRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_NAME, req.name);
};

const annotatePlanResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, res.planId ?? res.id);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_NAME, res.name);
};

// ---------- Features annotators ----------

const annotateFeatureRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_NAME, req.name);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_TYPE, req.type);
};

const annotateFeatureResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.featureId ?? res.id);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_NAME, res.name);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_TYPE, res.type);
};

// ---------- Referrals annotators ----------

const annotateReferralRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID, req.programId);
  setIfString(span, SEMATTRS_AUTUMN_REFERRAL_CODE, req.code);
};

const annotateReferralResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_REFERRAL_CODE, res.code);
  setIfString(span, SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID, res.programId);
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfString(span, SEMATTRS_AUTUMN_REWARD_ID, res.rewardId);
};

// `createProgram` takes the new program's id as `id`; get/update/delete take
// `referralProgramId`.
const annotateReferralProgramRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID, req.referralProgramId ?? req.id);
  setIfString(span, SEMATTRS_AUTUMN_REWARD_ID, req.rewardId);
};

const annotateReferralProgramResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID, res.id);
  setIfString(span, SEMATTRS_AUTUMN_REWARD_ID, res.rewardId);
};

// ---------- Invoices annotators ----------

const annotateInvoiceRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_INVOICE_AUTUMN_ID, req.invoiceId);
  setIfBoolean(span, SEMATTRS_AUTUMN_IS_PREVIEW, req.preview);
  setPlanIds(span, extractPlanIds(req.plans));
};

const annotateInvoiceResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  if (isObject(res.invoice)) {
    const invoice = res.invoice;
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_AUTUMN_ID, invoice.id);
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_ID, invoice.stripeId);
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_STATUS, invoice.status);
    setIfNumber(span, SEMATTRS_AUTUMN_TOTAL_AMOUNT, invoice.total);
    setIfString(span, SEMATTRS_AUTUMN_CURRENCY, invoice.currency);
    setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, invoice.customerId);
    setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, invoice.entityId);
    if (Array.isArray(invoice.planIds)) {
      setPlanIds(span, invoice.planIds.filter((id): id is string => typeof id === "string"));
    }
  } else if (isObject(res.preview)) {
    // `create`/`reissue` with `preview: true` return totals without an invoice.
    setIfNumber(span, SEMATTRS_AUTUMN_TOTAL_AMOUNT, res.preview.total);
    setIfString(span, SEMATTRS_AUTUMN_CURRENCY, res.preview.currency);
  }
};

const annotateInsertInvoicesResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfArrayLength(span, SEMATTRS_AUTUMN_RESULT_COUNT, res.invoices);
};

// ---------- Licenses annotators ----------

const annotateLicenseRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId ?? req.licensePlanId);
  setIfArrayLength(span, SEMATTRS_AUTUMN_ENTITY_COUNT, req.entities ?? req.entityIds);
};

// ---------- Rewards annotators ----------

function readRewardType(value: AnyRecord): string | undefined {
  if (isObject(value.coupon)) return "coupon";
  if (isObject(value.featureGrant)) return "feature_grant";
  return undefined;
}

const annotateRewardRequest: Annotator = (span, req, config) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_REWARD_ID, req.rewardId);
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_REWARD_TYPE, readRewardType(req));
  // Promo codes are redeemable by anyone holding them.
  if (config.captureCustomerData) {
    setIfString(span, SEMATTRS_AUTUMN_REWARD_CODE, req.code);
  }
};

const annotateRewardResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  const reward = isObject(res.coupon) ? res.coupon : isObject(res.featureGrant) ? res.featureGrant : undefined;
  setIfString(span, SEMATTRS_AUTUMN_REWARD_ID, reward?.id ?? res.rewardId);
  setIfString(span, SEMATTRS_AUTUMN_REWARD_TYPE, readRewardType(res));
  setIfArrayLength(span, SEMATTRS_AUTUMN_ENTITLEMENT_COUNT, res.entitlementsGranted);
  setIfBoolean(span, SEMATTRS_AUTUMN_SUCCESS, res.success);
};

const annotateRewardListResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  const coupons = Array.isArray(res.coupons) ? res.coupons.length : 0;
  const grants = Array.isArray(res.featureGrants) ? res.featureGrants.length : 0;
  span.setAttribute(SEMATTRS_AUTUMN_RESULT_COUNT, coupons + grants);
};

// ---------- Platform / sandboxes annotators ----------
// Keys, platform and sandbox responses carry credentials (access/refresh
// tokens, OAuth tokens/URLs, sandbox secret keys). Only the allow-listed
// fields below are ever read from them.

const annotatePlatformRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_ORGANIZATION_SLUG, req.organizationSlug);
  setIfString(span, SEMATTRS_AUTUMN_ENV, req.env);
};

const annotatePlatformResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfBoolean(span, SEMATTRS_AUTUMN_CONNECTED, res.connected);
  setIfBoolean(span, SEMATTRS_AUTUMN_SUCCESS, res.success);
  setIfArrayLength(span, SEMATTRS_AUTUMN_RESULT_COUNT, res.results);
};

const annotateSandboxRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_SANDBOX_ID, req.id);
  setIfString(span, SEMATTRS_AUTUMN_SANDBOX_NAME, req.name);
};

const annotateSandboxResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_SANDBOX_ID, res.id);
  setIfString(span, SEMATTRS_AUTUMN_SANDBOX_NAME, res.name);
  setIfBoolean(span, SEMATTRS_AUTUMN_SUCCESS, res.success);
};

// ---------- Generic fallbacks ----------

const annotateGenericIdRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
};

const annotateListResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfArrayLength(span, SEMATTRS_AUTUMN_RESULT_COUNT, res.list);
  setIfBoolean(span, SEMATTRS_AUTUMN_HAS_MORE, readHasMore(res));
};

// ---------- Wrapping plumbing ----------

interface MethodSpec {
  name: string;
  requestAnnotator?: Annotator;
  responseAnnotator?: Annotator;
}

interface ResourceSpec {
  name: string;
  methods: MethodSpec[];
}

function wrapAsyncMethod(
  originalMethod: AnyAsync,
  resourceName: string | null,
  operationName: string,
  tracer: Tracer,
  config: InstrumentAutumnConfig,
  requestAnnotator?: Annotator,
  responseAnnotator?: Annotator,
): AnyAsync {
  const target = resourceName ? `${resourceName}.${operationName}` : operationName;
  const spanName = `autumn.${target}`;
  const resourceTag = resourceName ?? operationName;

  return async function instrumented(this: unknown, ...args: unknown[]): Promise<unknown> {
    const span = tracer.startSpan(spanName, { kind: SpanKind.CLIENT });

    span.setAttributes({
      [SEMATTRS_BILLING_SYSTEM]: "autumn",
      [SEMATTRS_BILLING_OPERATION]: target,
      [SEMATTRS_AUTUMN_RESOURCE]: resourceTag,
      [SEMATTRS_AUTUMN_TARGET]: target,
    });

    if (config.captureRequestAttributes !== false && requestAnnotator && args.length > 0) {
      try {
        requestAnnotator(span, args[0], config);
      } catch {
        // Never fail the caller because of annotation bugs
      }
    }

    const activeContext = trace.setSpan(context.active(), span);

    try {
      const result = await context.with(activeContext, () => originalMethod.apply(this, args));
      if (config.captureResponseAttributes !== false && responseAnnotator) {
        try {
          responseAnnotator(span, unwrapResult(result), config);
        } catch {
          // swallow
        }
      }
      finalizeSpan(span);
      return result;
    } catch (error) {
      finalizeSpan(span, error);
      throw error;
    }
  };
}

function instrumentResource(
  resource: unknown,
  spec: ResourceSpec,
  tracer: Tracer,
  config: InstrumentAutumnConfig,
): void {
  if (!isObject(resource)) return;
  if ((resource as InstrumentedFlagged)[INSTRUMENTED_FLAG]) return;

  for (const method of spec.methods) {
    const fn = (resource as AnyRecord)[method.name];
    if (typeof fn !== "function") continue;
    const bound = (fn as AnyAsync).bind(resource);
    (resource as AnyRecord)[method.name] = wrapAsyncMethod(
      bound,
      spec.name,
      method.name,
      tracer,
      config,
      method.requestAnnotator,
      method.responseAnnotator,
    );
  }

  (resource as InstrumentedFlagged)[INSTRUMENTED_FLAG] = true;
}

// ---------- Resource specs ----------

const BILLING_SPEC: ResourceSpec = {
  name: "billing",
  methods: [
    { name: "attach", requestAnnotator: annotateAttachRequest, responseAnnotator: annotateAttachResponse },
    { name: "multiAttach", requestAnnotator: annotateMultiAttachRequest, responseAnnotator: annotateAttachResponse },
    { name: "previewAttach", requestAnnotator: annotateAttachRequest, responseAnnotator: annotatePreviewResponse },
    { name: "previewMultiAttach", requestAnnotator: annotateMultiAttachRequest, responseAnnotator: annotatePreviewResponse },
    { name: "update", requestAnnotator: annotateUpdateRequest, responseAnnotator: annotateAttachResponse },
    { name: "previewUpdate", requestAnnotator: annotateUpdateRequest, responseAnnotator: annotatePreviewResponse },
    { name: "multiUpdate", requestAnnotator: annotateMultiUpdateRequest, responseAnnotator: annotateAttachResponse },
    { name: "previewMultiUpdate", requestAnnotator: annotateMultiUpdateRequest, responseAnnotator: annotatePreviewResponse },
    { name: "createSchedule", requestAnnotator: annotateCreateScheduleRequest, responseAnnotator: annotateCreateScheduleResponse },
    { name: "openCustomerPortal", requestAnnotator: annotateBillingCustomerRequest, responseAnnotator: annotatePortalResponse },
    { name: "setupPayment", requestAnnotator: annotateBillingCustomerRequest, responseAnnotator: annotateSetupPaymentResponse },
    { name: "import", requestAnnotator: annotateImportRequest, responseAnnotator: annotateImportResponse },
  ],
};

const CUSTOMERS_SPEC: ResourceSpec = {
  name: "customers",
  methods: [
    { name: "getOrCreate", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
    { name: "get", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
    { name: "list", responseAnnotator: annotateListResponse },
    { name: "update", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
    { name: "delete", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
    { name: "advanceTestClock", requestAnnotator: annotateAdvanceTestClockRequest, responseAnnotator: annotateAdvanceTestClockResponse },
  ],
};

const ENTITIES_SPEC: ResourceSpec = {
  name: "entities",
  methods: [
    { name: "create", requestAnnotator: annotateEntityRequest, responseAnnotator: annotateEntityResponse },
    { name: "get", requestAnnotator: annotateEntityRequest, responseAnnotator: annotateEntityResponse },
    { name: "list", requestAnnotator: annotateGenericIdRequest, responseAnnotator: annotateListResponse },
    { name: "update", requestAnnotator: annotateEntityRequest, responseAnnotator: annotateEntityResponse },
    { name: "delete", requestAnnotator: annotateEntityRequest, responseAnnotator: annotateEntityResponse },
  ],
};

const BALANCES_SPEC: ResourceSpec = {
  name: "balances",
  methods: [
    { name: "create", requestAnnotator: annotateBalanceRequest, responseAnnotator: annotateBalanceResponse },
    { name: "update", requestAnnotator: annotateBalanceRequest, responseAnnotator: annotateBalanceResponse },
    { name: "delete", requestAnnotator: annotateBalanceRequest, responseAnnotator: annotateBalanceResponse },
    { name: "finalize", requestAnnotator: annotateBalanceRequest, responseAnnotator: annotateBalanceResponse },
  ],
};

const EVENTS_SPEC: ResourceSpec = {
  name: "events",
  methods: [
    { name: "list", requestAnnotator: annotateEventsListRequest, responseAnnotator: annotateEventsListResponse },
    { name: "aggregate", requestAnnotator: annotateEventsAggregateRequest, responseAnnotator: annotateEventsAggregateResponse },
  ],
};

const PLANS_SPEC: ResourceSpec = {
  name: "plans",
  methods: [
    { name: "create", requestAnnotator: annotatePlanRequest, responseAnnotator: annotatePlanResponse },
    { name: "get", requestAnnotator: annotatePlanRequest, responseAnnotator: annotatePlanResponse },
    { name: "list", responseAnnotator: annotateListResponse },
    { name: "update", requestAnnotator: annotatePlanRequest, responseAnnotator: annotatePlanResponse },
    { name: "delete", requestAnnotator: annotatePlanRequest, responseAnnotator: annotatePlanResponse },
  ],
};

const FEATURES_SPEC: ResourceSpec = {
  name: "features",
  methods: [
    { name: "create", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
    { name: "get", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
    { name: "list", responseAnnotator: annotateListResponse },
    { name: "update", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
    { name: "delete", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
  ],
};

const REFERRALS_SPEC: ResourceSpec = {
  name: "referrals",
  methods: [
    { name: "createCode", requestAnnotator: annotateReferralRequest, responseAnnotator: annotateReferralResponse },
    { name: "redeemCode", requestAnnotator: annotateReferralRequest, responseAnnotator: annotateReferralResponse },
    { name: "createProgram", requestAnnotator: annotateReferralProgramRequest, responseAnnotator: annotateReferralProgramResponse },
    { name: "listPrograms", responseAnnotator: annotateListResponse },
    { name: "getProgram", requestAnnotator: annotateReferralProgramRequest, responseAnnotator: annotateReferralProgramResponse },
    { name: "updateProgram", requestAnnotator: annotateReferralProgramRequest, responseAnnotator: annotateReferralProgramResponse },
    { name: "deleteProgram", requestAnnotator: annotateReferralProgramRequest, responseAnnotator: annotateSuccessResponse },
  ],
};

const INVOICES_SPEC: ResourceSpec = {
  name: "invoices",
  methods: [
    { name: "create", requestAnnotator: annotateInvoiceRequest, responseAnnotator: annotateInvoiceResponse },
    { name: "insert", responseAnnotator: annotateInsertInvoicesResponse },
    { name: "list", requestAnnotator: annotateGenericIdRequest, responseAnnotator: annotateListResponse },
    { name: "listTemplates", responseAnnotator: annotateListResponse },
    { name: "pay", requestAnnotator: annotateInvoiceRequest, responseAnnotator: annotateInvoiceResponse },
    { name: "reissue", requestAnnotator: annotateInvoiceRequest, responseAnnotator: annotateInvoiceResponse },
    { name: "void", requestAnnotator: annotateInvoiceRequest, responseAnnotator: annotateInvoiceResponse },
  ],
};

const LICENSES_SPEC: ResourceSpec = {
  name: "licenses",
  methods: [
    { name: "attach", requestAnnotator: annotateLicenseRequest, responseAnnotator: annotateSuccessResponse },
    { name: "release", requestAnnotator: annotateLicenseRequest, responseAnnotator: annotateSuccessResponse },
  ],
};

const REWARDS_SPEC: ResourceSpec = {
  name: "rewards",
  methods: [
    { name: "create", requestAnnotator: annotateRewardRequest, responseAnnotator: annotateRewardResponse },
    { name: "list", responseAnnotator: annotateRewardListResponse },
    { name: "get", requestAnnotator: annotateRewardRequest, responseAnnotator: annotateRewardResponse },
    { name: "update", requestAnnotator: annotateRewardRequest, responseAnnotator: annotateRewardResponse },
    { name: "delete", requestAnnotator: annotateRewardRequest, responseAnnotator: annotateRewardResponse },
    { name: "redeemCode", requestAnnotator: annotateRewardRequest, responseAnnotator: annotateRewardResponse },
  ],
};

// No response annotators: mint/refresh return access and refresh tokens.
const KEYS_SPEC: ResourceSpec = {
  name: "keys",
  methods: [
    { name: "mint", requestAnnotator: annotateGenericIdRequest },
    { name: "refresh" },
    { name: "revoke", requestAnnotator: annotateGenericIdRequest },
  ],
};

// No request annotator: the free-text search query may contain customer PII.
const LOGS_SPEC: ResourceSpec = {
  name: "logs",
  methods: [{ name: "search", responseAnnotator: annotateListResponse }],
};

const PLATFORM_SPEC: ResourceSpec = {
  name: "platform",
  methods: [
    { name: "getStripeConnection", requestAnnotator: annotatePlatformRequest, responseAnnotator: annotatePlatformResponse },
    { name: "disconnectStripe", requestAnnotator: annotatePlatformRequest, responseAnnotator: annotatePlatformResponse },
    { name: "linkRevenueCat", requestAnnotator: annotatePlatformRequest },
    { name: "syncRevenueCat", requestAnnotator: annotatePlatformRequest, responseAnnotator: annotatePlatformResponse },
    { name: "getRevenueCatKeys", requestAnnotator: annotatePlatformRequest },
  ],
};

const SANDBOXES_SPEC: ResourceSpec = {
  name: "sandboxes",
  methods: [
    { name: "create", requestAnnotator: annotateSandboxRequest, responseAnnotator: annotateSandboxResponse },
    { name: "list", responseAnnotator: annotateListResponse },
    { name: "delete", requestAnnotator: annotateSandboxRequest, responseAnnotator: annotateSandboxResponse },
    { name: "reset", responseAnnotator: annotateSandboxResponse },
  ],
};

interface SubResource {
  key: keyof Autumn;
  spec: ResourceSpec;
  flag: keyof InstrumentAutumnConfig;
}

const SUB_RESOURCES: SubResource[] = [
  { key: "billing", spec: BILLING_SPEC, flag: "instrumentBilling" },
  { key: "customers", spec: CUSTOMERS_SPEC, flag: "instrumentCustomers" },
  { key: "entities", spec: ENTITIES_SPEC, flag: "instrumentEntities" },
  { key: "balances", spec: BALANCES_SPEC, flag: "instrumentBalances" },
  { key: "events", spec: EVENTS_SPEC, flag: "instrumentEvents" },
  { key: "plans", spec: PLANS_SPEC, flag: "instrumentPlans" },
  { key: "features", spec: FEATURES_SPEC, flag: "instrumentFeatures" },
  { key: "referrals", spec: REFERRALS_SPEC, flag: "instrumentReferrals" },
  { key: "invoices", spec: INVOICES_SPEC, flag: "instrumentInvoices" },
  { key: "licenses", spec: LICENSES_SPEC, flag: "instrumentLicenses" },
  { key: "rewards", spec: REWARDS_SPEC, flag: "instrumentRewards" },
  { key: "keys", spec: KEYS_SPEC, flag: "instrumentKeys" },
  { key: "logs", spec: LOGS_SPEC, flag: "instrumentLogs" },
  { key: "platform", spec: PLATFORM_SPEC, flag: "instrumentPlatform" },
  { key: "sandboxes", spec: SANDBOXES_SPEC, flag: "instrumentSandboxes" },
];

function wrapTopLevel(
  client: Autumn,
  operationName: "check" | "track" | "trackTokens" | "batchTrack" | "attach" | "cancel" | "setupPayment" | "usage",
  tracer: Tracer,
  config: InstrumentAutumnConfig,
  requestAnnotator: Annotator,
  responseAnnotator: Annotator,
): void {
  const original = (client as unknown as AnyRecord)[operationName];
  if (typeof original !== "function") return;
  const bound = (original as AnyAsync).bind(client);
  (client as unknown as AnyRecord)[operationName] = wrapAsyncMethod(
    bound,
    null,
    operationName,
    tracer,
    config,
    requestAnnotator,
    responseAnnotator,
  );
}

/**
 * Instruments an Autumn SDK client with OpenTelemetry tracing.
 *
 * Wraps the flat `check`/`track`/`trackTokens`/`batchTrack` methods plus every
 * sub-resource operation (`billing.*`, `customers.*`, `entities.*`,
 * `balances.*`, `events.*`, `plans.*`, `features.*`, `referrals.*`,
 * `invoices.*`, `licenses.*`, `rewards.*`, `keys.*`, `logs.*`, `platform.*`,
 * `sandboxes.*`). Methods and sub-resources missing from the installed
 * autumn-js version are skipped. Instrumentation is idempotent — calling it
 * twice on the same client is a no-op.
 *
 * @example
 * ```ts
 * import { Autumn } from "autumn-js";
 * import { instrumentAutumn } from "@api-blitz/otel-autumn";
 *
 * const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });
 * instrumentAutumn(autumn);
 *
 * await autumn.check({ customerId: "cus_123", featureId: "messages" });
 * await autumn.billing.attach({ customerId: "cus_123", planId: "pro" });
 * ```
 */
export function instrumentAutumn<T extends Autumn>(
  client: T,
  config: InstrumentAutumnConfig = {},
): T {
  if (!client) return client;
  if ((client as unknown as InstrumentedFlagged)[INSTRUMENTED_FLAG]) return client;

  const tracer = trace.getTracer(config.tracerName ?? DEFAULT_TRACER_NAME);

  wrapTopLevel(client, "check", tracer, config, annotateCheckRequest, annotateCheckResponse);
  wrapTopLevel(client, "track", tracer, config, annotateTrackRequest, annotateTrackResponse);
  wrapTopLevel(client, "trackTokens", tracer, config, annotateTrackTokensRequest, annotateTrackResponse);
  wrapTopLevel(client, "batchTrack", tracer, config, annotateBatchTrackRequest, annotateSuccessResponse);

  // Pre-1.0 autumn-js exposed billing flows as flat top-level methods. In 1.x
  // these live under `autumn.billing.*` (or were replaced, e.g. `cancel` →
  // `billing.update({ cancelAction })`), so the Autumn class doesn't expose
  // them and each wrap is a no-op (wrapTopLevel checks typeof before wrapping).
  wrapTopLevel(client, "attach", tracer, config, annotateAttachRequest, annotateAttachResponse);
  wrapTopLevel(client, "cancel", tracer, config, annotateCancelRequest, annotateCancelResponse);
  wrapTopLevel(client, "setupPayment", tracer, config, annotateBillingCustomerRequest, annotateSetupPaymentResponse);
  wrapTopLevel(client, "usage", tracer, config, annotateUsageRequest, annotateUsageResponse);

  for (const sub of SUB_RESOURCES) {
    if (config[sub.flag] === false) continue;
    let resource: unknown;
    try {
      // Eagerly trigger the v1 lazy getter so subsequent accesses return the
      // same cached instance we patched.
      resource = (client as unknown as AnyRecord)[sub.key as string];
    } catch {
      continue;
    }
    if (resource) {
      instrumentResource(resource, sub.spec, tracer, config);
    }
  }

  (client as unknown as InstrumentedFlagged)[INSTRUMENTED_FLAG] = true;
  return client;
}

export type { Autumn } from "autumn-js";
