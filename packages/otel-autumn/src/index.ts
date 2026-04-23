import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import type { Autumn } from "autumn-js";

const DEFAULT_TRACER_NAME = "@kubiks/otel-autumn";
const INSTRUMENTED_FLAG = Symbol("kubiksOtelAutumnInstrumented");

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

// Events attributes
export const SEMATTRS_AUTUMN_EVENT_COUNT = "autumn.event_count" as const;
export const SEMATTRS_AUTUMN_PERIOD_COUNT = "autumn.period_count" as const;
export const SEMATTRS_AUTUMN_AGGREGATE_RANGE = "autumn.aggregate_range" as const;

// Referral attributes
export const SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID = "autumn.referral_program_id" as const;
export const SEMATTRS_AUTUMN_REFERRAL_CODE = "autumn.referral_code" as const;

/**
 * Configuration for Autumn instrumentation.
 */
export interface InstrumentAutumnConfig {
  /** Tracer name; defaults to "@kubiks/otel-autumn". */
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

function extractPlanIds(plans: unknown): string[] | undefined {
  if (!Array.isArray(plans)) return undefined;
  const ids = plans
    .map((plan) => (isObject(plan) && typeof plan.planId === "string" ? plan.planId : undefined))
    .filter((id): id is string => typeof id === "string");
  return ids.length > 0 ? ids : undefined;
}

// ---------- Top-level annotators ----------

const annotateCheckRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfNumber(span, SEMATTRS_AUTUMN_REQUIRED_BALANCE, req.requiredBalance);
  setIfBoolean(span, SEMATTRS_AUTUMN_SEND_EVENT, req.sendEvent);
  setIfBoolean(span, SEMATTRS_AUTUMN_WITH_PREVIEW, req.withPreview);
  if (isObject(req.lock)) {
    setIfString(span, SEMATTRS_AUTUMN_LOCK, req.lock.lockId);
  }
};

const annotateCheckResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfBoolean(span, SEMATTRS_AUTUMN_ALLOWED, res.allowed);
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.entityId);
  setIfNumber(span, SEMATTRS_AUTUMN_REQUIRED_BALANCE, res.requiredBalance);
  if (isObject(res.balance)) {
    setIfNumber(span, SEMATTRS_AUTUMN_BALANCE, res.balance.remaining);
    setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.balance.featureId);
    if (isObject(res.balance.feature)) {
      setIfString(span, SEMATTRS_AUTUMN_FEATURE_NAME, res.balance.feature.name);
      setIfString(span, SEMATTRS_AUTUMN_FEATURE_TYPE, res.balance.feature.type);
    }
  }
  if (isObject(res.flag)) {
    setIfString(span, SEMATTRS_AUTUMN_FLAG_ID, res.flag.id);
    setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, res.flag.planId);
  }
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PREVIEW, Boolean(res.preview));
  if (isObject(res.preview)) {
    setIfString(span, SEMATTRS_AUTUMN_PLAN_SCENARIO, res.preview.scenario);
  }
};

const annotateTrackRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, req.featureId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_EVENT_NAME, req.eventName);
  setIfNumber(span, SEMATTRS_AUTUMN_VALUE, req.value);
  if (isObject(req.lock)) {
    setIfString(span, SEMATTRS_AUTUMN_LOCK, req.lock.lockId);
  }
};

const annotateTrackResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.entityId);
  setIfString(span, SEMATTRS_AUTUMN_EVENT_NAME, res.eventName);
  setIfNumber(span, SEMATTRS_AUTUMN_VALUE, res.value);
  if (isObject(res.balance)) {
    setIfNumber(span, SEMATTRS_AUTUMN_BALANCE, res.balance.remaining);
    setIfString(span, SEMATTRS_AUTUMN_FEATURE_ID, res.balance.featureId);
  }
  if (isObject(res.balances)) {
    span.setAttribute(SEMATTRS_AUTUMN_BALANCE_COUNT, Object.keys(res.balances).length);
  }
};

// ---------- Billing annotators ----------

const annotateAttachRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfString(span, SEMATTRS_AUTUMN_PLAN_ID, req.planId);
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
};

const annotateMultiAttachRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
  setIfBoolean(span, SEMATTRS_AUTUMN_INVOICE_MODE, readEnabled(req.invoiceMode));
  setIfString(span, SEMATTRS_AUTUMN_REDIRECT_MODE, req.redirectMode);
  setIfBoolean(span, SEMATTRS_AUTUMN_NEW_BILLING_SUBSCRIPTION, req.newBillingSubscription);
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

const annotateBillingCustomerRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
};

const annotateAttachResponse: Annotator = (span, res, config) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, res.entityId);
  if (isObject(res.invoice)) {
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_ID, res.invoice.stripeId);
    setIfString(span, SEMATTRS_AUTUMN_INVOICE_STATUS, res.invoice.status);
    setIfNumber(span, SEMATTRS_AUTUMN_TOTAL_AMOUNT, res.invoice.total);
    setIfString(span, SEMATTRS_AUTUMN_CURRENCY, res.invoice.currency);
  }
  const hasUrl = typeof res.paymentUrl === "string" && res.paymentUrl.length > 0;
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PAYMENT_URL, hasUrl);
  if (hasUrl && config.captureCustomerData) {
    setIfString(span, SEMATTRS_AUTUMN_PAYMENT_URL, res.paymentUrl);
  }
  if (isObject(res.requiredAction)) {
    setIfString(span, SEMATTRS_AUTUMN_REQUIRED_ACTION, res.requiredAction.code);
  }
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
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  const url = typeof res.url === "string" ? res.url : undefined;
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PORTAL_URL, Boolean(url));
  if (url && config.captureCustomerData) {
    span.setAttribute(SEMATTRS_AUTUMN_PORTAL_URL, url);
  }
};

const annotateSetupPaymentResponse: Annotator = (span, res, config) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.customerId);
  const url = typeof res.url === "string" ? res.url : undefined;
  span.setAttribute(SEMATTRS_AUTUMN_HAS_PAYMENT_URL, Boolean(url));
  if (url && config.captureCustomerData) {
    span.setAttribute(SEMATTRS_AUTUMN_PAYMENT_URL, url);
  }
};

// ---------- Customers annotators ----------

const annotateCustomerRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.id ?? req.customerId);
};

const annotateCustomerResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, res.id ?? res.customerId);
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
  setIfBoolean(span, "autumn.has_more", res.hasMore);
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
};

// ---------- Generic fallbacks ----------

const annotateGenericIdRequest: Annotator = (span, req) => {
  if (!isObject(req)) return;
  setIfString(span, SEMATTRS_AUTUMN_CUSTOMER_ID, req.customerId);
  setIfString(span, SEMATTRS_AUTUMN_ENTITY_ID, req.entityId);
};

const annotateGenericIdResponse: Annotator = (span, res) => {
  if (!isObject(res)) return;
  if (typeof res.id === "string") {
    span.setAttribute("autumn.id", res.id);
  }
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
          responseAnnotator(span, result, config);
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
    { name: "openCustomerPortal", requestAnnotator: annotateBillingCustomerRequest, responseAnnotator: annotatePortalResponse },
    { name: "setupPayment", requestAnnotator: annotateBillingCustomerRequest, responseAnnotator: annotateSetupPaymentResponse },
  ],
};

const CUSTOMERS_SPEC: ResourceSpec = {
  name: "customers",
  methods: [
    { name: "getOrCreate", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
    { name: "list", responseAnnotator: annotateGenericIdResponse },
    { name: "update", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
    { name: "delete", requestAnnotator: annotateCustomerRequest, responseAnnotator: annotateCustomerResponse },
  ],
};

const ENTITIES_SPEC: ResourceSpec = {
  name: "entities",
  methods: [
    { name: "create", requestAnnotator: annotateEntityRequest, responseAnnotator: annotateEntityResponse },
    { name: "get", requestAnnotator: annotateEntityRequest, responseAnnotator: annotateEntityResponse },
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
    { name: "list", responseAnnotator: annotateGenericIdResponse },
    { name: "update", requestAnnotator: annotatePlanRequest, responseAnnotator: annotatePlanResponse },
    { name: "delete", requestAnnotator: annotatePlanRequest, responseAnnotator: annotatePlanResponse },
  ],
};

const FEATURES_SPEC: ResourceSpec = {
  name: "features",
  methods: [
    { name: "create", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
    { name: "get", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
    { name: "list", responseAnnotator: annotateGenericIdResponse },
    { name: "update", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
    { name: "delete", requestAnnotator: annotateFeatureRequest, responseAnnotator: annotateFeatureResponse },
  ],
};

const REFERRALS_SPEC: ResourceSpec = {
  name: "referrals",
  methods: [
    { name: "createCode", requestAnnotator: annotateReferralRequest, responseAnnotator: annotateReferralResponse },
    { name: "redeemCode", requestAnnotator: annotateReferralRequest, responseAnnotator: annotateReferralResponse },
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
];

function wrapTopLevel(
  client: Autumn,
  operationName: "check" | "track",
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
 * Wraps the flat `check`/`track` methods plus every sub-resource operation
 * (`billing.*`, `customers.*`, `entities.*`, `balances.*`, `events.*`,
 * `plans.*`, `features.*`, `referrals.*`). Instrumentation is idempotent —
 * calling it twice on the same client is a no-op.
 *
 * @example
 * ```ts
 * import { Autumn } from "autumn-js";
 * import { instrumentAutumn } from "@kubiks/otel-autumn";
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
