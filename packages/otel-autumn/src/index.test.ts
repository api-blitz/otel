import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { Autumn, HTTPClient } from "autumn-js";
import {
  instrumentAutumn,
  SEMATTRS_AUTUMN_ALLOWED,
  SEMATTRS_AUTUMN_ASYNC,
  SEMATTRS_AUTUMN_BALANCE,
  SEMATTRS_AUTUMN_BATCH_SIZE,
  SEMATTRS_AUTUMN_BILLABLE_COUNT,
  SEMATTRS_AUTUMN_CACHE_READ_TOKENS,
  SEMATTRS_AUTUMN_CANCEL_ACTION,
  SEMATTRS_AUTUMN_CARRY_OVER_BALANCES,
  SEMATTRS_AUTUMN_CONNECTED,
  SEMATTRS_AUTUMN_CURRENCY,
  SEMATTRS_AUTUMN_CUSTOMER_ID,
  SEMATTRS_AUTUMN_DEDUCTION_COUNT,
  SEMATTRS_AUTUMN_DRY_RUN,
  SEMATTRS_AUTUMN_ENTITLEMENT_COUNT,
  SEMATTRS_AUTUMN_ENTITY_COUNT,
  SEMATTRS_AUTUMN_ENTITY_FEATURE_ID,
  SEMATTRS_AUTUMN_ENTITY_ID,
  SEMATTRS_AUTUMN_ENV,
  SEMATTRS_AUTUMN_EVENT_COUNT,
  SEMATTRS_AUTUMN_FEATURE_ID,
  SEMATTRS_AUTUMN_FLAG_ID,
  SEMATTRS_AUTUMN_FROZEN_TIME,
  SEMATTRS_AUTUMN_HAS_MORE,
  SEMATTRS_AUTUMN_HAS_PAYMENT_URL,
  SEMATTRS_AUTUMN_HAS_PORTAL_URL,
  SEMATTRS_AUTUMN_HAS_PREVIEW,
  SEMATTRS_AUTUMN_IMPORT_COUNT,
  SEMATTRS_AUTUMN_INPUT_TOKENS,
  SEMATTRS_AUTUMN_INVOICE_AUTUMN_ID,
  SEMATTRS_AUTUMN_INVOICE_ID,
  SEMATTRS_AUTUMN_INVOICE_MODE,
  SEMATTRS_AUTUMN_INVOICE_STATUS,
  SEMATTRS_AUTUMN_IS_PREVIEW,
  SEMATTRS_AUTUMN_MODEL_ID,
  SEMATTRS_AUTUMN_ORGANIZATION_SLUG,
  SEMATTRS_AUTUMN_OUTPUT_TOKENS,
  SEMATTRS_AUTUMN_OVERAGE_BEHAVIOR,
  SEMATTRS_AUTUMN_PAYMENT_URL,
  SEMATTRS_AUTUMN_PHASE_COUNT,
  SEMATTRS_AUTUMN_PLAN_COUNT,
  SEMATTRS_AUTUMN_PLAN_ID,
  SEMATTRS_AUTUMN_PLAN_IDS,
  SEMATTRS_AUTUMN_REASONING_TOKENS,
  SEMATTRS_AUTUMN_REFERRAL_CODE,
  SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID,
  SEMATTRS_AUTUMN_REQUIRED_BALANCE,
  SEMATTRS_AUTUMN_RESOURCE,
  SEMATTRS_AUTUMN_RESULT_COUNT,
  SEMATTRS_AUTUMN_REWARD_CODE,
  SEMATTRS_AUTUMN_REWARD_ID,
  SEMATTRS_AUTUMN_REWARD_TYPE,
  SEMATTRS_AUTUMN_SANDBOX_ID,
  SEMATTRS_AUTUMN_SANDBOX_NAME,
  SEMATTRS_AUTUMN_SCHEDULE_ID,
  SEMATTRS_AUTUMN_SCHEDULE_STATUS,
  SEMATTRS_AUTUMN_SEND_EVENT,
  SEMATTRS_AUTUMN_SUCCESS,
  SEMATTRS_AUTUMN_TARGET,
  SEMATTRS_AUTUMN_TEST_CLOCK_STATUS,
  SEMATTRS_AUTUMN_TOTAL_AMOUNT,
  SEMATTRS_AUTUMN_UPDATE_COUNT,
  SEMATTRS_AUTUMN_VALUE,
  SEMATTRS_BILLING_OPERATION,
  SEMATTRS_BILLING_SYSTEM,
} from "./index";

let exporter: InMemorySpanExporter;
let provider: BasicTracerProvider;

beforeEach(() => {
  exporter = new InMemorySpanExporter();
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
});

afterEach(async () => {
  await provider.shutdown();
  exporter.reset();
  trace.disable();
});

function createMockAutumnClient() {
  return {
    check: vi.fn().mockResolvedValue({
      allowed: true,
      customerId: "cus_1",
      balance: { featureId: "messages", remaining: 42, granted: 100, usage: 58, unlimited: false, overageAllowed: false, maxPurchase: null, nextResetAt: null, feature: { name: "Messages", type: "metered" } },
      flag: { id: "flag_1", planId: "pro", featureId: "messages", expiresAt: null },
    }),
    track: vi.fn().mockResolvedValue({
      customerId: "cus_1",
      value: 1,
      balance: { featureId: "messages", remaining: 41, granted: 100, usage: 59, unlimited: false, overageAllowed: false, maxPurchase: null, nextResetAt: null },
    }),
    billing: {
      attach: vi.fn().mockResolvedValue({
        customerId: "cus_1",
        paymentUrl: "https://checkout.stripe.com/pay/cs_test",
        invoice: { stripeId: "in_1", status: "paid", total: 2000, currency: "usd", hostedInvoiceUrl: null },
      }),
      multiAttach: vi.fn().mockResolvedValue({ customerId: "cus_1", paymentUrl: null }),
      previewAttach: vi.fn().mockResolvedValue({ customerId: "cus_1", total: 2000, currency: "usd", hasProrations: true }),
      previewMultiAttach: vi.fn().mockResolvedValue({ customerId: "cus_1", total: 5000, currency: "usd", hasProrations: false }),
      update: vi.fn().mockResolvedValue({ customerId: "cus_1", paymentUrl: null }),
      previewUpdate: vi.fn().mockResolvedValue({ customerId: "cus_1", total: 1000, currency: "usd", hasProrations: true }),
      openCustomerPortal: vi.fn().mockResolvedValue({ customerId: "cus_1", url: "https://billing.stripe.com/session/tok" }),
      setupPayment: vi.fn().mockResolvedValue({ customerId: "cus_1", url: "https://checkout.stripe.com/setup/cs_test" }),
    },
    customers: {
      getOrCreate: vi.fn().mockResolvedValue({ id: "cus_1", name: "Ada" }),
      list: vi.fn().mockResolvedValue({ items: [] }),
      update: vi.fn().mockResolvedValue({ id: "cus_1" }),
      delete: vi.fn().mockResolvedValue({ id: "cus_1" }),
    },
    entities: {
      create: vi.fn().mockResolvedValue({ id: "seat_1", customerId: "cus_1", featureId: "seats" }),
      get: vi.fn().mockResolvedValue({ id: "seat_1", customerId: "cus_1", featureId: "seats" }),
      update: vi.fn().mockResolvedValue({ id: "seat_1" }),
      delete: vi.fn().mockResolvedValue({ id: "seat_1" }),
    },
    balances: {
      create: vi.fn().mockResolvedValue({ featureId: "messages", remaining: 10 }),
      update: vi.fn().mockResolvedValue({ featureId: "messages", remaining: 20 }),
      delete: vi.fn().mockResolvedValue({ featureId: "messages" }),
      finalize: vi.fn().mockResolvedValue({ featureId: "messages", remaining: 15 }),
    },
    events: {
      list: vi.fn().mockResolvedValue({
        list: [{ id: "evt_1" }, { id: "evt_2" }],
        hasMore: false,
        offset: 0,
        limit: 50,
        total: 2,
      }),
      aggregate: vi.fn().mockResolvedValue({
        list: [
          { period: 1700000000000, values: { messages: 512 } },
          { period: 1700086400000, values: { messages: 1024 } },
        ],
        total: { messages: { count: 2, sum: 1536 } },
      }),
    },
    plans: {
      create: vi.fn().mockResolvedValue({ planId: "pro", name: "Pro" }),
      get: vi.fn().mockResolvedValue({ planId: "pro", name: "Pro" }),
      list: vi.fn().mockResolvedValue({ items: [] }),
      update: vi.fn().mockResolvedValue({ planId: "pro", name: "Pro" }),
      delete: vi.fn().mockResolvedValue({ planId: "pro" }),
    },
    features: {
      create: vi.fn().mockResolvedValue({ featureId: "messages", name: "Messages", type: "metered" }),
      get: vi.fn().mockResolvedValue({ featureId: "messages", name: "Messages", type: "metered" }),
      list: vi.fn().mockResolvedValue({ items: [] }),
      update: vi.fn().mockResolvedValue({ featureId: "messages" }),
      delete: vi.fn().mockResolvedValue({ featureId: "messages" }),
    },
    referrals: {
      createCode: vi.fn().mockResolvedValue({ code: "REF123", programId: "prog_1" }),
      redeemCode: vi.fn().mockResolvedValue({ code: "REF123" }),
    },
  };
}

type MockClient = ReturnType<typeof createMockAutumnClient>;

function findSpan(name: string) {
  const span = exporter.getFinishedSpans().find((s) => s.name === name);
  if (!span) {
    throw new Error(`span ${name} not found; saw ${exporter.getFinishedSpans().map((s) => s.name).join(", ") || "<none>"}`);
  }
  return span;
}

describe("@api-blitz/otel-autumn", () => {
  describe("lifecycle", () => {
    it("returns the same instance", () => {
      const client = createMockAutumnClient();
      const instrumented = instrumentAutumn(client as never);
      expect(instrumented).toBe(client);
    });

    it("is idempotent", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);
      instrumentAutumn(client as never);

      await (client as MockClient).check({ customerId: "cus_1", featureId: "messages" });

      expect(exporter.getFinishedSpans().length).toBe(1);
    });

    it("handles null/undefined clients", () => {
      expect(instrumentAutumn(null as never)).toBe(null);
      expect(instrumentAutumn(undefined as never)).toBe(undefined);
    });
  });

  describe("top-level methods", () => {
    it("creates an autumn.check span with request + response attributes", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.check({
        customerId: "cus_1",
        featureId: "messages",
        requiredBalance: 3,
        sendEvent: true,
      } as never);

      const span = findSpan("autumn.check");
      expect(span.attributes[SEMATTRS_BILLING_SYSTEM]).toBe("autumn");
      expect(span.attributes[SEMATTRS_BILLING_OPERATION]).toBe("check");
      expect(span.attributes[SEMATTRS_AUTUMN_RESOURCE]).toBe("check");
      expect(span.attributes[SEMATTRS_AUTUMN_TARGET]).toBe("check");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBe("messages");
      expect(span.attributes[SEMATTRS_AUTUMN_REQUIRED_BALANCE]).toBe(3);
      expect(span.attributes[SEMATTRS_AUTUMN_SEND_EVENT]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_ALLOWED]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_BALANCE]).toBe(42);
      expect(span.attributes[SEMATTRS_AUTUMN_FLAG_ID]).toBe("flag_1");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("pro");
      expect(span.attributes[SEMATTRS_AUTUMN_HAS_PREVIEW]).toBe(false);
      expect(span.status.code).toBe(SpanStatusCode.OK);
    });

    it("creates an autumn.track span with request + response attributes", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.track({
        customerId: "cus_1",
        featureId: "messages",
        value: 1,
      } as never);

      const span = findSpan("autumn.track");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBe("messages");
      expect(span.attributes[SEMATTRS_AUTUMN_VALUE]).toBe(1);
      expect(span.attributes[SEMATTRS_AUTUMN_BALANCE]).toBe(41);
    });

    it("records errors and sets ERROR status", async () => {
      const client = createMockAutumnClient();
      client.check = vi.fn().mockRejectedValue(new Error("boom"));
      instrumentAutumn(client as never);

      await expect(client.check({ customerId: "cus_1", featureId: "x" } as never)).rejects.toThrow("boom");

      const span = findSpan("autumn.check");
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.events.some((e) => e.name === "exception")).toBe(true);
    });
  });

  describe("billing sub-resource", () => {
    it("wraps billing.attach with plan + payment-url attributes", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.billing.attach({
        customerId: "cus_1",
        planId: "pro",
        version: 2,
        invoiceMode: { enabled: true },
        carryOverBalances: { enabled: true, featureIds: ["messages"] },
        carryOverUsages: { enabled: false },
        noBillingChanges: false,
        featureQuantities: [
          { featureId: "seats", quantity: 5 },
          { featureId: "api_calls", quantity: 10_000 },
        ],
        discounts: [{ code: "SAVE10" }],
      } as never);

      const span = findSpan("autumn.billing.attach");
      expect(span.attributes[SEMATTRS_BILLING_OPERATION]).toBe("billing.attach");
      expect(span.attributes[SEMATTRS_AUTUMN_RESOURCE]).toBe("billing");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("pro");
      expect(span.attributes[SEMATTRS_AUTUMN_INVOICE_MODE]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_CARRY_OVER_BALANCES]).toBe(true);
      expect(span.attributes["autumn.carry_over_usages"]).toBe(false);
      expect(span.attributes[SEMATTRS_AUTUMN_HAS_PAYMENT_URL]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_INVOICE_ID]).toBe("in_1");
      expect(span.attributes[SEMATTRS_AUTUMN_PAYMENT_URL]).toBeUndefined();
      expect(span.attributes["autumn.feature_quantities_count"]).toBe(2);
      expect(span.attributes["autumn.discount_count"]).toBe(1);
      expect(span.attributes["autumn.no_billing_changes"]).toBe(false);
      expect(span.attributes["autumn.plan_version"]).toBe(2);
    });

    it("captures paymentUrl when captureCustomerData is enabled", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never, { captureCustomerData: true });

      await client.billing.attach({ customerId: "cus_1", planId: "pro" } as never);

      const span = findSpan("autumn.billing.attach");
      expect(span.attributes[SEMATTRS_AUTUMN_PAYMENT_URL]).toBe("https://checkout.stripe.com/pay/cs_test");
    });

    it("captures plan_ids on billing.multiAttach", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.billing.multiAttach({
        customerId: "cus_1",
        plans: [{ planId: "pro" }, { planId: "addon_seats" }],
      } as never);

      const span = findSpan("autumn.billing.multiAttach");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_IDS]).toBe("pro,addon_seats");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_COUNT]).toBe(2);
    });

    it("captures cancelAction on billing.update", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.billing.update({
        customerId: "cus_1",
        planId: "pro",
        cancelAction: "cancel_end_of_cycle",
      } as never);

      const span = findSpan("autumn.billing.update");
      expect(span.attributes[SEMATTRS_AUTUMN_CANCEL_ACTION]).toBe("cancel_end_of_cycle");
    });

    it("emits has_portal_url without the url itself by default", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.billing.openCustomerPortal({ customerId: "cus_1" } as never);

      const span = findSpan("autumn.billing.openCustomerPortal");
      expect(span.attributes[SEMATTRS_AUTUMN_HAS_PORTAL_URL]).toBe(true);
      expect(span.attributes["autumn.portal_url"]).toBeUndefined();
    });

    it("covers preview and setupPayment spans", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.billing.previewAttach({ customerId: "cus_1", planId: "pro" } as never);
      await client.billing.previewMultiAttach({ customerId: "cus_1", plans: [{ planId: "pro" }] } as never);
      await client.billing.previewUpdate({ customerId: "cus_1", planId: "pro" } as never);
      await client.billing.setupPayment({ customerId: "cus_1" } as never);

      const names = exporter.getFinishedSpans().map((s) => s.name);
      expect(names).toContain("autumn.billing.previewAttach");
      expect(names).toContain("autumn.billing.previewMultiAttach");
      expect(names).toContain("autumn.billing.previewUpdate");
      expect(names).toContain("autumn.billing.setupPayment");
    });
  });

  describe("customers sub-resource", () => {
    it("wraps getOrCreate/list/update/delete", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.customers.getOrCreate({ id: "cus_1", email: "ada@example.com" } as never);
      await client.customers.list();
      await client.customers.update({ id: "cus_1" } as never);
      await client.customers.delete({ id: "cus_1" } as never);

      const names = exporter.getFinishedSpans().map((s) => s.name);
      expect(names).toEqual([
        "autumn.customers.getOrCreate",
        "autumn.customers.list",
        "autumn.customers.update",
        "autumn.customers.delete",
      ]);
      expect(findSpan("autumn.customers.getOrCreate").attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
    });
  });

  describe("entities sub-resource", () => {
    it("captures feature id distinct from check's feature id", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.entities.create({
        customerId: "cus_1",
        entityId: "seat_1",
        featureId: "seats",
        name: "Seat 1",
      } as never);

      const span = findSpan("autumn.entities.create");
      expect(span.attributes[SEMATTRS_AUTUMN_ENTITY_ID]).toBe("seat_1");
      expect(span.attributes[SEMATTRS_AUTUMN_ENTITY_FEATURE_ID]).toBe("seats");
    });

    it("wraps all four methods", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.entities.create({ customerId: "cus_1", entityId: "seat_1", featureId: "seats" } as never);
      await client.entities.get({ entityId: "seat_1" } as never);
      await client.entities.update({ entityId: "seat_1" } as never);
      await client.entities.delete({ entityId: "seat_1" } as never);

      const names = exporter.getFinishedSpans().map((s) => s.name);
      expect(names).toEqual([
        "autumn.entities.create",
        "autumn.entities.get",
        "autumn.entities.update",
        "autumn.entities.delete",
      ]);
    });
  });

  describe("balances sub-resource", () => {
    it("wraps all four methods", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.balances.create({ customerId: "cus_1", featureId: "messages", value: 10 } as never);
      await client.balances.update({ customerId: "cus_1", featureId: "messages", value: 20 } as never);
      await client.balances.delete({ customerId: "cus_1", featureId: "messages" } as never);
      await client.balances.finalize({ customerId: "cus_1", featureId: "messages", lockId: "lock_1" } as never);

      const names = exporter.getFinishedSpans().map((s) => s.name);
      expect(names).toEqual([
        "autumn.balances.create",
        "autumn.balances.update",
        "autumn.balances.delete",
        "autumn.balances.finalize",
      ]);
    });
  });

  describe("events sub-resource", () => {
    it("records event_count and has_more on list", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.events.list({ customerId: "cus_1" } as never);

      const span = findSpan("autumn.events.list");
      expect(span.attributes[SEMATTRS_AUTUMN_EVENT_COUNT]).toBe(2);
      expect(span.attributes["autumn.has_more"]).toBe(false);
    });

    it("records aggregate totals summed across features", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.events.aggregate({ customerId: "cus_1", range: "7d" } as never);

      const span = findSpan("autumn.events.aggregate");
      expect(span.attributes[SEMATTRS_AUTUMN_EVENT_COUNT]).toBe(2);
      expect(span.attributes[SEMATTRS_AUTUMN_VALUE]).toBe(1536);
      expect(span.attributes["autumn.period_count"]).toBe(2);
      expect(span.attributes["autumn.feature_count"]).toBe(1);
    });
  });

  describe("plans sub-resource", () => {
    it("wraps all five methods", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.plans.create({ planId: "pro", name: "Pro" } as never);
      await client.plans.get({ planId: "pro" } as never);
      await client.plans.list();
      await client.plans.update({ planId: "pro" } as never);
      await client.plans.delete({ planId: "pro" } as never);

      const names = exporter.getFinishedSpans().map((s) => s.name);
      expect(names).toEqual([
        "autumn.plans.create",
        "autumn.plans.get",
        "autumn.plans.list",
        "autumn.plans.update",
        "autumn.plans.delete",
      ]);
      expect(findSpan("autumn.plans.create").attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("pro");
    });
  });

  describe("features sub-resource", () => {
    it("wraps all five methods", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.features.create({ featureId: "messages", name: "Messages", type: "metered" } as never);
      await client.features.get({ featureId: "messages" } as never);
      await client.features.list();
      await client.features.update({ featureId: "messages" } as never);
      await client.features.delete({ featureId: "messages" } as never);

      const names = exporter.getFinishedSpans().map((s) => s.name);
      expect(names).toEqual([
        "autumn.features.create",
        "autumn.features.get",
        "autumn.features.list",
        "autumn.features.update",
        "autumn.features.delete",
      ]);
      expect(findSpan("autumn.features.create").attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBe("messages");
    });
  });

  describe("referrals sub-resource", () => {
    it("captures the referral code", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await client.referrals.createCode({ customerId: "cus_1", programId: "prog_1" } as never);
      await client.referrals.redeemCode({ customerId: "cus_1", code: "REF123" } as never);

      const create = findSpan("autumn.referrals.createCode");
      const redeem = findSpan("autumn.referrals.redeemCode");
      expect(create.attributes[SEMATTRS_AUTUMN_REFERRAL_CODE]).toBe("REF123");
      expect(redeem.attributes[SEMATTRS_AUTUMN_REFERRAL_CODE]).toBe("REF123");
    });
  });

  describe("configuration flags", () => {
    it("skips a sub-resource when its instrument flag is false", async () => {
      const client = createMockAutumnClient();
      const originalPlansGet = client.plans.get;
      instrumentAutumn(client as never, { instrumentPlans: false });

      expect(client.plans.get).toBe(originalPlansGet);

      await client.plans.get({ planId: "pro" } as never);
      expect(exporter.getFinishedSpans().length).toBe(0);
    });

    it("respects captureResponseAttributes: false", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never, { captureResponseAttributes: false });

      await client.check({ customerId: "cus_1", featureId: "messages" } as never);

      const span = findSpan("autumn.check");
      expect(span.attributes[SEMATTRS_AUTUMN_ALLOWED]).toBeUndefined();
      expect(span.attributes[SEMATTRS_AUTUMN_BALANCE]).toBeUndefined();
    });

    it("respects captureRequestAttributes: false", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never, { captureRequestAttributes: false });

      await client.check({ customerId: "cus_1", featureId: "messages" } as never);

      const span = findSpan("autumn.check");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1"); // response still sets it
      expect(span.attributes[SEMATTRS_AUTUMN_REQUIRED_BALANCE]).toBeUndefined();
    });
  });

  describe("concurrency", () => {
    it("creates independent spans for concurrent calls", async () => {
      const client = createMockAutumnClient();
      instrumentAutumn(client as never);

      await Promise.all([
        client.check({ customerId: "cus_a", featureId: "messages" } as never),
        client.check({ customerId: "cus_b", featureId: "messages" } as never),
        client.track({ customerId: "cus_c", featureId: "messages", value: 1 } as never),
      ]);

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBe(3);
      expect(spans.filter((s) => s.name === "autumn.check").length).toBe(2);
      expect(spans.filter((s) => s.name === "autumn.track").length).toBe(1);
    });
  });

  describe("pre-1.0 compatibility", () => {
    function createMockPreV1Client() {
      // Mirrors autumn-js 0.0.80: top-level attach/cancel/setupPayment/usage
      // with snake_case fields, responses wrapped as Result<T, E> = { data, error }.
      return {
        check: vi.fn().mockResolvedValue({
          data: {
            allowed: true,
            customer_id: "cus_1",
            balance: { feature_id: "messages", remaining: 42 },
          },
          error: null,
        }),
        track: vi.fn().mockResolvedValue({
          data: {
            id: "evt_1",
            customer_id: "cus_1",
            feature_id: "messages",
          },
          error: null,
        }),
        attach: vi.fn().mockResolvedValue({
          data: {
            checkout_url: "https://checkout.stripe.com/pay/cs_test",
            customer_id: "cus_1",
            product_ids: ["pro"],
            code: "ok",
            message: "",
          },
          error: null,
        }),
        cancel: vi.fn().mockResolvedValue({
          data: { success: true, customer_id: "cus_1", product_id: "pro" },
          error: null,
        }),
        setupPayment: vi.fn().mockResolvedValue({
          data: { customer_id: "cus_1", url: "https://checkout.stripe.com/setup/cs_test" },
          error: null,
        }),
        usage: vi.fn().mockResolvedValue({
          data: { code: "ok", customer_id: "cus_1", feature_id: "messages" },
          error: null,
        }),
      };
    }

    it("wraps top-level attach with product_id → plan_id and checkout_url", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);

      await client.attach({
        customer_id: "cus_1",
        product_id: "pro",
      } as never);

      const span = findSpan("autumn.attach");
      expect(span.attributes[SEMATTRS_BILLING_OPERATION]).toBe("attach");
      expect(span.attributes[SEMATTRS_AUTUMN_RESOURCE]).toBe("attach");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("pro");
      expect(span.attributes[SEMATTRS_AUTUMN_HAS_PAYMENT_URL]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_PAYMENT_URL]).toBeUndefined();
      // product_ids array in response surfaces as plan_ids
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_IDS]).toBe("pro");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_COUNT]).toBe(1);
    });

    it("emits checkout_url when captureCustomerData is enabled", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never, { captureCustomerData: true });

      await client.attach({ customer_id: "cus_1", product_id: "pro" } as never);

      const span = findSpan("autumn.attach");
      expect(span.attributes[SEMATTRS_AUTUMN_PAYMENT_URL]).toBe("https://checkout.stripe.com/pay/cs_test");
    });

    it("wraps top-level cancel and maps cancel_immediately to cancel_action", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);

      await client.cancel({
        customer_id: "cus_1",
        product_id: "pro",
        cancel_immediately: true,
      } as never);

      const span = findSpan("autumn.cancel");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("pro");
      expect(span.attributes[SEMATTRS_AUTUMN_CANCEL_ACTION]).toBe("cancel_immediately");
    });

    it("wraps top-level cancel with cancel_immediately false as end_of_cycle", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);

      await client.cancel({
        customer_id: "cus_1",
        product_id: "pro",
        cancel_immediately: false,
      } as never);

      const span = findSpan("autumn.cancel");
      expect(span.attributes[SEMATTRS_AUTUMN_CANCEL_ACTION]).toBe("cancel_end_of_cycle");
    });

    it("wraps top-level setupPayment", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);

      await client.setupPayment({ customer_id: "cus_1" } as never);

      const span = findSpan("autumn.setupPayment");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_HAS_PAYMENT_URL]).toBe(true);
    });

    it("wraps top-level usage", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);

      await client.usage({
        customer_id: "cus_1",
        feature_id: "messages",
        value: 5,
      } as never);

      const span = findSpan("autumn.usage");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBe("messages");
      expect(span.attributes[SEMATTRS_AUTUMN_VALUE]).toBe(5);
    });

    it("unwraps Result<T,E> for check response annotation", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);

      await client.check({ customer_id: "cus_1", feature_id: "messages" } as never);

      const span = findSpan("autumn.check");
      // request side reads snake_case
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBe("messages");
      // response side reads through the Result wrapper
      expect(span.attributes[SEMATTRS_AUTUMN_ALLOWED]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_BALANCE]).toBe(42);
    });

    it("does not crash when a pre-1.0 client lacks 1.x sub-resources", () => {
      const client = createMockPreV1Client();
      // Note: no billing, customers, entities, balances, events, plans, features, referrals
      expect(() => instrumentAutumn(client as never)).not.toThrow();
    });

    it("remains idempotent on a pre-1.0-shaped client", async () => {
      const client = createMockPreV1Client();
      instrumentAutumn(client as never);
      instrumentAutumn(client as never);

      await client.attach({ customer_id: "cus_1", product_id: "pro" } as never);

      expect(exporter.getFinishedSpans().length).toBe(1);
    });

    it("reads positional customer ids and snake_case has_more", async () => {
      const client = {
        customers: {
          get: vi.fn().mockResolvedValue({ data: { id: "cus_1" }, error: null }),
        },
        events: {
          list: vi.fn().mockResolvedValue({ data: { list: [{ id: "evt_1" }], has_more: true }, error: null }),
        },
      };
      instrumentAutumn(client as never);

      await client.customers.get("cus_1");
      await client.events.list({ customer_id: "cus_1" });

      expect(findSpan("autumn.customers.get").attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(findSpan("autumn.events.list").attributes[SEMATTRS_AUTUMN_HAS_MORE]).toBe(true);
    });
  });

  describe("autumn-js 1.2.x / 1.3.x surface", () => {
    // Mirrors the methods autumn-js added after 1.2.11: new top-level
    // token/batch tracking, new billing flows, and seven new sub-resources.
    function createMockLatestClient() {
      return {
        ...createMockAutumnClient(),
        trackTokens: vi.fn().mockResolvedValue({
          customerId: "cus_1",
          value: 12.5,
          balance: { featureId: "ai_credits", remaining: 987.5 },
          deductions: [{ balanceId: "bal_1", featureId: "ai_credits", planId: "pro", reset: null, value: 12.5 }],
        }),
        batchTrack: vi.fn().mockResolvedValue({ success: true }),
        billing: {
          ...createMockAutumnClient().billing,
          createSchedule: vi.fn().mockResolvedValue({
            customerId: "cus_1",
            entityId: null,
            status: "pending_payment",
            scheduleId: "sched_1",
            phases: [
              { phaseId: "ph_1", startsAt: 1, customerProductIds: [] },
              { phaseId: "ph_2", startsAt: 2, customerProductIds: [] },
            ],
            paymentUrl: "https://checkout.stripe.com/pay/cs_sched",
          }),
          multiUpdate: vi.fn().mockResolvedValue({ customerId: "cus_1", paymentUrl: null }),
          previewMultiUpdate: vi.fn().mockResolvedValue({ customerId: "cus_1", currency: "usd", total: 750, subscriptions: [] }),
          import: vi.fn().mockResolvedValue({
            customerId: "cus_1",
            flashed: [{ planId: "pro", processor: "stripe", customerProductId: null, status: "active", skipped: false }],
            customer: null,
          }),
        },
        customers: {
          ...createMockAutumnClient().customers,
          get: vi.fn().mockResolvedValue({ id: "cus_1", name: "Ada" }),
          list: vi.fn().mockResolvedValue({ list: [{ id: "cus_1" }, { id: "cus_2" }], nextCursor: "cur_2" }),
          advanceTestClock: vi.fn().mockResolvedValue({ customerId: "cus_1", frozenTime: 1_800_000_000_000, status: "advancing" }),
        },
        entities: {
          ...createMockAutumnClient().entities,
          list: vi.fn().mockResolvedValue({ list: [{ id: "seat_1" }], nextCursor: null }),
        },
        events: {
          ...createMockAutumnClient().events,
          list: vi.fn().mockResolvedValue({ list: [{ id: "evt_1" }], nextCursor: "cur_evt" }),
        },
        referrals: {
          ...createMockAutumnClient().referrals,
          redeemCode: vi.fn().mockResolvedValue({ id: "red_1", customerId: "cus_2", rewardId: "rew_1" }),
          createProgram: vi.fn().mockResolvedValue({ id: "prog_1", rewardId: "rew_1" }),
          listPrograms: vi.fn().mockResolvedValue({ list: [{ id: "prog_1" }] }),
          getProgram: vi.fn().mockResolvedValue({ id: "prog_1", rewardId: "rew_1" }),
          updateProgram: vi.fn().mockResolvedValue({ id: "prog_1", rewardId: "rew_2" }),
          deleteProgram: vi.fn().mockResolvedValue({ success: true }),
        },
        invoices: {
          create: vi.fn().mockResolvedValue({
            invoice: {
              id: "inv_1",
              stripeId: "in_1",
              status: "open",
              total: 4200,
              currency: "usd",
              customerId: "cus_1",
              entityId: null,
              planIds: ["pro"],
            },
            preview: { currency: "usd", total: 4200 },
          }),
          insert: vi.fn().mockResolvedValue({ invoices: [{ id: "inv_2" }, { id: "inv_3" }] }),
          list: vi.fn().mockResolvedValue({ list: [{ id: "inv_1" }], nextCursor: null }),
          listTemplates: vi.fn().mockResolvedValue({ list: [], total: 0, limit: 10, offset: 0, hasMore: false }),
          pay: vi.fn().mockResolvedValue({ invoice: { id: "inv_1", stripeId: "in_1", status: "paid", total: 4200, currency: "usd" } }),
          reissue: vi.fn().mockResolvedValue({ invoice: null, voidedInvoiceId: null, creditNoteId: null, preview: { currency: "eur", total: 3900 } }),
          void: vi.fn().mockResolvedValue({ invoice: { id: "inv_1", stripeId: "in_1", status: "void", total: 4200, currency: "usd" } }),
        },
        licenses: {
          attach: vi.fn().mockResolvedValue({ success: true }),
          release: vi.fn().mockResolvedValue({ success: true }),
        },
        rewards: {
          create: vi.fn().mockResolvedValue({ coupon: { id: "rew_coupon", promoCodes: [{ code: "SECRET50" }] } }),
          list: vi.fn().mockResolvedValue({ coupons: [{ id: "rew_coupon" }], featureGrants: [{ id: "rew_grant" }, { id: "rew_grant_2" }] }),
          get: vi.fn().mockResolvedValue({ featureGrant: { id: "rew_grant" } }),
          update: vi.fn().mockResolvedValue({ coupon: { id: "rew_coupon" } }),
          delete: vi.fn().mockResolvedValue({ success: true }),
          redeemCode: vi.fn().mockResolvedValue({ rewardId: "rew_grant", entitlementsGranted: [{ featureId: "messages", balance: 100 }] }),
        },
        keys: {
          mint: vi.fn().mockResolvedValue({ accessToken: "ak_secret", refreshToken: "rk_secret", expiresAt: null }),
          refresh: vi.fn().mockResolvedValue({ accessToken: "ak_secret_2", refreshToken: "rk_secret_2", expiresAt: 1 }),
          revoke: vi.fn().mockResolvedValue({ revoked: true }),
        },
        logs: {
          search: vi.fn().mockResolvedValue({ list: [{ id: "log_1" }, { id: "log_2" }, { id: "log_3" }] }),
        },
        platform: {
          getStripeConnection: vi.fn().mockResolvedValue({ connected: true, accountId: "acct_1", connectedAt: 1 }),
          disconnectStripe: vi.fn().mockResolvedValue({ success: true }),
          linkRevenueCat: vi.fn().mockResolvedValue({ oauthUrl: "https://app.revenuecat.com/oauth?token=secret" }),
          syncRevenueCat: vi.fn().mockResolvedValue({ results: [{}, {}] }),
          getRevenueCatKeys: vi.fn().mockResolvedValue({ apps: [], oauthAccessToken: "rc_secret" }),
        },
        sandboxes: {
          create: vi.fn().mockResolvedValue({ id: "sbx_1", name: "QA", slug: "qa", secretKey: "am_sk_test_secret" }),
          list: vi.fn().mockResolvedValue({ list: [{ id: "sbx_1" }] }),
          delete: vi.fn().mockResolvedValue({ success: true }),
          reset: vi.fn().mockResolvedValue({ success: true }),
        },
      };
    }

    function allAttributeValues(): string[] {
      return exporter.getFinishedSpans().flatMap((s) => Object.values(s.attributes).map(String));
    }

    it("wraps trackTokens with model + token counts", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.trackTokens({
        customerId: "cus_1",
        modelId: "anthropic/claude-opus-4-8",
        inputTokens: 1200,
        outputTokens: 340,
        cacheReadTokens: 800,
        reasoningTokens: 50,
        overageBehavior: "overflow",
      } as never);

      const span = findSpan("autumn.trackTokens");
      expect(span.attributes[SEMATTRS_BILLING_OPERATION]).toBe("trackTokens");
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_MODEL_ID]).toBe("anthropic/claude-opus-4-8");
      expect(span.attributes[SEMATTRS_AUTUMN_INPUT_TOKENS]).toBe(1200);
      expect(span.attributes[SEMATTRS_AUTUMN_OUTPUT_TOKENS]).toBe(340);
      expect(span.attributes[SEMATTRS_AUTUMN_CACHE_READ_TOKENS]).toBe(800);
      expect(span.attributes[SEMATTRS_AUTUMN_REASONING_TOKENS]).toBe(50);
      expect(span.attributes[SEMATTRS_AUTUMN_OVERAGE_BEHAVIOR]).toBe("overflow");
      expect(span.attributes[SEMATTRS_AUTUMN_VALUE]).toBe(12.5);
      expect(span.attributes[SEMATTRS_AUTUMN_BALANCE]).toBe(987.5);
      expect(span.attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBe("ai_credits");
      expect(span.attributes[SEMATTRS_AUTUMN_DEDUCTION_COUNT]).toBe(1);
    });

    it("captures overageBehavior and async on track", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.track({ customerId: "cus_1", featureId: "messages", overageBehavior: "cap", async: true } as never);

      const span = findSpan("autumn.track");
      expect(span.attributes[SEMATTRS_AUTUMN_OVERAGE_BEHAVIOR]).toBe("cap");
      expect(span.attributes[SEMATTRS_AUTUMN_ASYNC]).toBe(true);
    });

    it("wraps batchTrack with batch size and uniform identity only", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.batchTrack([
        { customerId: "cus_1", featureId: "messages", value: 1 },
        { customerId: "cus_1", featureId: "api_calls", value: 5 },
      ] as never);

      const span = findSpan("autumn.batchTrack");
      expect(span.attributes[SEMATTRS_AUTUMN_BATCH_SIZE]).toBe(2);
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(span.attributes[SEMATTRS_AUTUMN_FEATURE_ID]).toBeUndefined();
      expect(span.attributes[SEMATTRS_AUTUMN_SUCCESS]).toBe(true);
    });

    it("wraps billing.createSchedule with deduped phase plan ids", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.billing.createSchedule({
        customerId: "cus_1",
        billingBehavior: "prorate_immediately",
        phases: [
          { plans: [{ planId: "pro" }, { planId: "addon_seats" }] },
          { startsAt: 1_800_000_000_000, plans: [{ planId: "pro" }] },
        ],
      } as never);

      const span = findSpan("autumn.billing.createSchedule");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_IDS]).toBe("pro,addon_seats");
      expect(span.attributes[SEMATTRS_AUTUMN_PLAN_COUNT]).toBe(2);
      expect(span.attributes[SEMATTRS_AUTUMN_PHASE_COUNT]).toBe(2);
      expect(span.attributes["autumn.billing_behavior"]).toBe("prorate_immediately");
      expect(span.attributes[SEMATTRS_AUTUMN_SCHEDULE_ID]).toBe("sched_1");
      expect(span.attributes[SEMATTRS_AUTUMN_SCHEDULE_STATUS]).toBe("pending_payment");
      expect(span.attributes[SEMATTRS_AUTUMN_HAS_PAYMENT_URL]).toBe(true);
      expect(span.attributes[SEMATTRS_AUTUMN_PAYMENT_URL]).toBeUndefined();
    });

    it("wraps billing.multiUpdate / previewMultiUpdate / import", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      const updates = [
        { planId: "pro", cancelAction: "cancel_end_of_cycle" },
        { planId: "addon_seats", cancelAction: "cancel_immediately" },
      ];
      await client.billing.multiUpdate({ customerId: "cus_1", updates } as never);
      await client.billing.previewMultiUpdate({ customerId: "cus_1", updates } as never);
      await client.billing.import({ customerId: "cus_1", billables: [{}, {}], dryRun: true } as never);

      const update = findSpan("autumn.billing.multiUpdate");
      expect(update.attributes[SEMATTRS_AUTUMN_UPDATE_COUNT]).toBe(2);
      expect(update.attributes[SEMATTRS_AUTUMN_PLAN_IDS]).toBe("pro,addon_seats");
      expect(update.attributes[SEMATTRS_AUTUMN_HAS_PAYMENT_URL]).toBe(false);

      const preview = findSpan("autumn.billing.previewMultiUpdate");
      expect(preview.attributes[SEMATTRS_AUTUMN_TOTAL_AMOUNT]).toBe(750);
      expect(preview.attributes[SEMATTRS_AUTUMN_CURRENCY]).toBe("usd");

      const imported = findSpan("autumn.billing.import");
      expect(imported.attributes[SEMATTRS_AUTUMN_BILLABLE_COUNT]).toBe(2);
      expect(imported.attributes[SEMATTRS_AUTUMN_DRY_RUN]).toBe(true);
      expect(imported.attributes[SEMATTRS_AUTUMN_IMPORT_COUNT]).toBe(1);
    });

    it("wraps customers.get / advanceTestClock and cursor-paginated list", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.customers.get({ customerId: "cus_1" } as never);
      await client.customers.list({ limit: 2 } as never);
      await client.customers.advanceTestClock({ customerId: "cus_1", frozenTime: 1_800_000_000_000 } as never);

      expect(findSpan("autumn.customers.get").attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      const list = findSpan("autumn.customers.list");
      expect(list.attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(2);
      expect(list.attributes[SEMATTRS_AUTUMN_HAS_MORE]).toBe(true);
      const clock = findSpan("autumn.customers.advanceTestClock");
      expect(clock.attributes[SEMATTRS_AUTUMN_FROZEN_TIME]).toBe(1_800_000_000_000);
      expect(clock.attributes[SEMATTRS_AUTUMN_TEST_CLOCK_STATUS]).toBe("advancing");
    });

    it("derives has_more from nextCursor on events.list and entities.list", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.events.list({ customerId: "cus_1" } as never);
      await client.entities.list({ customerId: "cus_1" } as never);

      const events = findSpan("autumn.events.list");
      expect(events.attributes[SEMATTRS_AUTUMN_EVENT_COUNT]).toBe(1);
      expect(events.attributes[SEMATTRS_AUTUMN_HAS_MORE]).toBe(true);
      const entities = findSpan("autumn.entities.list");
      expect(entities.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      expect(entities.attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(1);
      expect(entities.attributes[SEMATTRS_AUTUMN_HAS_MORE]).toBe(false);
    });

    it("wraps referral programs and reads reward id from redeemCode", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.referrals.createProgram({ id: "prog_1", rewardId: "rew_1", redeemOn: "checkout", receivedBy: "all" } as never);
      await client.referrals.listPrograms();
      await client.referrals.getProgram({ referralProgramId: "prog_1" } as never);
      await client.referrals.updateProgram({ referralProgramId: "prog_1", rewardId: "rew_2" } as never);
      await client.referrals.deleteProgram({ referralProgramId: "prog_1" } as never);
      await client.referrals.redeemCode({ customerId: "cus_2", code: "REF123" } as never);

      const created = findSpan("autumn.referrals.createProgram");
      expect(created.attributes[SEMATTRS_AUTUMN_REFERRAL_PROGRAM_ID]).toBe("prog_1");
      expect(created.attributes[SEMATTRS_AUTUMN_REWARD_ID]).toBe("rew_1");
      expect(findSpan("autumn.referrals.listPrograms").attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(1);
      expect(findSpan("autumn.referrals.updateProgram").attributes[SEMATTRS_AUTUMN_REWARD_ID]).toBe("rew_2");
      expect(findSpan("autumn.referrals.deleteProgram").attributes[SEMATTRS_AUTUMN_SUCCESS]).toBe(true);
      const redeemed = findSpan("autumn.referrals.redeemCode");
      expect(redeemed.attributes[SEMATTRS_AUTUMN_REFERRAL_CODE]).toBe("REF123");
      expect(redeemed.attributes[SEMATTRS_AUTUMN_REWARD_ID]).toBe("rew_1");
    });

    it("wraps invoices.* keeping autumn.invoice_id as the Stripe id", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.invoices.create({ customerId: "cus_1", plans: [{ planId: "pro" }] } as never);
      await client.invoices.insert({ invoices: [{}, {}] } as never);
      await client.invoices.list({ customerId: "cus_1" } as never);
      await client.invoices.listTemplates({} as never);
      await client.invoices.pay({ invoiceId: "inv_1" } as never);
      await client.invoices.reissue({ invoiceId: "inv_1", preview: true } as never);
      await client.invoices.void({ invoiceId: "inv_1" } as never);

      const created = findSpan("autumn.invoices.create");
      expect(created.attributes[SEMATTRS_AUTUMN_RESOURCE]).toBe("invoices");
      expect(created.attributes[SEMATTRS_AUTUMN_INVOICE_AUTUMN_ID]).toBe("inv_1");
      expect(created.attributes[SEMATTRS_AUTUMN_INVOICE_ID]).toBe("in_1");
      expect(created.attributes[SEMATTRS_AUTUMN_INVOICE_STATUS]).toBe("open");
      expect(created.attributes[SEMATTRS_AUTUMN_TOTAL_AMOUNT]).toBe(4200);
      expect(created.attributes[SEMATTRS_AUTUMN_PLAN_IDS]).toBe("pro");
      expect(findSpan("autumn.invoices.insert").attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(2);
      expect(findSpan("autumn.invoices.list").attributes[SEMATTRS_AUTUMN_HAS_MORE]).toBe(false);
      expect(findSpan("autumn.invoices.listTemplates").attributes[SEMATTRS_AUTUMN_HAS_MORE]).toBe(false);
      const paid = findSpan("autumn.invoices.pay");
      expect(paid.attributes[SEMATTRS_AUTUMN_INVOICE_AUTUMN_ID]).toBe("inv_1");
      expect(paid.attributes[SEMATTRS_AUTUMN_INVOICE_STATUS]).toBe("paid");
      const reissued = findSpan("autumn.invoices.reissue");
      expect(reissued.attributes[SEMATTRS_AUTUMN_IS_PREVIEW]).toBe(true);
      expect(reissued.attributes[SEMATTRS_AUTUMN_TOTAL_AMOUNT]).toBe(3900);
      expect(reissued.attributes[SEMATTRS_AUTUMN_CURRENCY]).toBe("eur");
      expect(findSpan("autumn.invoices.void").attributes[SEMATTRS_AUTUMN_INVOICE_STATUS]).toBe("void");
    });

    it("wraps licenses.attach / release", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.licenses.attach({ customerId: "cus_1", planId: "team", entities: [{ entityId: "e1" }, { entityId: "e2" }] } as never);
      await client.licenses.release({ customerId: "cus_1", licensePlanId: "team", entityIds: ["e1"] } as never);

      const attached = findSpan("autumn.licenses.attach");
      expect(attached.attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("team");
      expect(attached.attributes[SEMATTRS_AUTUMN_ENTITY_COUNT]).toBe(2);
      expect(attached.attributes[SEMATTRS_AUTUMN_SUCCESS]).toBe(true);
      const released = findSpan("autumn.licenses.release");
      expect(released.attributes[SEMATTRS_AUTUMN_PLAN_ID]).toBe("team");
      expect(released.attributes[SEMATTRS_AUTUMN_ENTITY_COUNT]).toBe(1);
    });

    it("wraps rewards.* and only captures promo codes with captureCustomerData", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.rewards.create({ coupon: { name: "50% off" } } as never);
      await client.rewards.list();
      await client.rewards.get({ rewardId: "rew_grant" } as never);
      await client.rewards.redeemCode({ customerId: "cus_1", code: "SECRET50" } as never);

      const created = findSpan("autumn.rewards.create");
      expect(created.attributes[SEMATTRS_AUTUMN_REWARD_ID]).toBe("rew_coupon");
      expect(created.attributes[SEMATTRS_AUTUMN_REWARD_TYPE]).toBe("coupon");
      expect(findSpan("autumn.rewards.list").attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(3);
      expect(findSpan("autumn.rewards.get").attributes[SEMATTRS_AUTUMN_REWARD_TYPE]).toBe("feature_grant");
      const redeemed = findSpan("autumn.rewards.redeemCode");
      expect(redeemed.attributes[SEMATTRS_AUTUMN_REWARD_ID]).toBe("rew_grant");
      expect(redeemed.attributes[SEMATTRS_AUTUMN_ENTITLEMENT_COUNT]).toBe(1);
      expect(redeemed.attributes[SEMATTRS_AUTUMN_REWARD_CODE]).toBeUndefined();
      expect(allAttributeValues()).not.toContain("SECRET50");
    });

    it("captures reward promo codes when captureCustomerData is enabled", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never, { captureCustomerData: true });

      await client.rewards.redeemCode({ customerId: "cus_1", code: "SECRET50" } as never);

      expect(findSpan("autumn.rewards.redeemCode").attributes[SEMATTRS_AUTUMN_REWARD_CODE]).toBe("SECRET50");
    });

    it("never records credentials from keys, platform or sandboxes, even with captureCustomerData", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never, { captureCustomerData: true });

      await client.keys.mint({ customerId: "cus_1" } as never);
      await client.keys.refresh({} as never);
      await client.keys.revoke({ customerId: "cus_1" } as never);
      await client.platform.getStripeConnection({ organizationSlug: "acme", env: "live" } as never);
      await client.platform.disconnectStripe({ organizationSlug: "acme", env: "live" } as never);
      await client.platform.linkRevenueCat({ organizationSlug: "acme", env: "live", projectName: "app", redirectUrl: "https://acme.dev" } as never);
      await client.platform.syncRevenueCat({ organizationSlug: "acme", env: "live" } as never);
      await client.platform.getRevenueCatKeys({ organizationSlug: "acme", env: "live" } as never);
      await client.sandboxes.create({ name: "QA" } as never);
      await client.sandboxes.list({} as never);
      await client.sandboxes.delete({ id: "sbx_1" } as never);
      await client.sandboxes.reset({} as never);

      expect(exporter.getFinishedSpans().length).toBe(12);
      expect(findSpan("autumn.keys.mint").attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
      const connection = findSpan("autumn.platform.getStripeConnection");
      expect(connection.attributes[SEMATTRS_AUTUMN_ORGANIZATION_SLUG]).toBe("acme");
      expect(connection.attributes[SEMATTRS_AUTUMN_ENV]).toBe("live");
      expect(connection.attributes[SEMATTRS_AUTUMN_CONNECTED]).toBe(true);
      expect(findSpan("autumn.platform.syncRevenueCat").attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(2);
      const sandbox = findSpan("autumn.sandboxes.create");
      expect(sandbox.attributes[SEMATTRS_AUTUMN_SANDBOX_ID]).toBe("sbx_1");
      expect(sandbox.attributes[SEMATTRS_AUTUMN_SANDBOX_NAME]).toBe("QA");

      const values = allAttributeValues().join("\n");
      for (const secret of ["ak_secret", "rk_secret", "rc_secret", "am_sk_test_secret", "token=secret"]) {
        expect(values).not.toContain(secret);
      }
    });

    it("counts logs.search results without recording the query", async () => {
      const client = createMockLatestClient();
      instrumentAutumn(client as never);

      await client.logs.search({ query: "ada@example.com", limit: 10 } as never);

      const span = findSpan("autumn.logs.search");
      expect(span.attributes[SEMATTRS_AUTUMN_RESULT_COUNT]).toBe(3);
      expect(allAttributeValues()).not.toContain("ada@example.com");
    });

    it("skips new sub-resources when their instrument flag is false", async () => {
      const client = createMockLatestClient();
      const originalMint = client.keys.mint;
      const originalCreate = client.invoices.create;
      const originalLicenseAttach = client.licenses.attach;
      instrumentAutumn(client as never, { instrumentKeys: false, instrumentInvoices: false });

      expect(client.keys.mint).toBe(originalMint);
      expect(client.invoices.create).toBe(originalCreate);
      expect(client.licenses.attach).not.toBe(originalLicenseAttach);
    });
  });

  describe("real autumn-js client", () => {
    // Drives the actual `Autumn` class from the installed autumn-js through a
    // stub fetcher so the lazy sub-resource getters and zod response parsing
    // are exercised without any network access.
    function createRealClient(routes: Record<string, { status?: number; body: unknown }>) {
      const requests: string[] = [];
      const httpClient = new HTTPClient({
        fetcher: async (input, init) => {
          const request = input instanceof Request ? input : new Request(input, init);
          const path = new URL(request.url).pathname;
          requests.push(path);
          const route = routes[path];
          if (!route) return new Response(JSON.stringify({ message: `no stub for ${path}` }), { status: 404 });
          return new Response(JSON.stringify(route.body), {
            status: route.status ?? 200,
            headers: { "content-type": "application/json" },
          });
        },
      });
      const client = new Autumn({
        secretKey: "am_sk_test_stub",
        httpClient,
        // The default fail-open hook swaps in its own fetch-based HTTP client.
        failOpen: false,
        serverURL: "http://127.0.0.1:1",
        retryConfig: { strategy: "none" },
      });
      return { client, requests };
    }

    it("instruments top-level and lazily created sub-resources on the real class", async () => {
      const { client, requests } = createRealClient({
        "/v1/balances.track_tokens": { body: { customer_id: "cus_1", value: 12.5, balance: null } },
        "/v1/balances.batch_track": { status: 202, body: { success: true } },
        "/v1/licenses.attach": { body: { success: true } },
      });
      instrumentAutumn(client);

      await client.trackTokens({ customerId: "cus_1", modelId: "openai/gpt-4o", inputTokens: 10, outputTokens: 5 });
      await client.batchTrack([{ customerId: "cus_1", featureId: "messages" }]);
      await client.licenses.attach({ customerId: "cus_1", planId: "team", entities: [{ entityId: "e1" }] });

      expect(requests).toEqual(["/v1/balances.track_tokens", "/v1/balances.batch_track", "/v1/licenses.attach"]);
      const tokens = findSpan("autumn.trackTokens");
      expect(tokens.attributes[SEMATTRS_AUTUMN_MODEL_ID]).toBe("openai/gpt-4o");
      expect(tokens.attributes[SEMATTRS_AUTUMN_VALUE]).toBe(12.5);
      expect(findSpan("autumn.batchTrack").attributes[SEMATTRS_AUTUMN_SUCCESS]).toBe(true);
      expect(findSpan("autumn.licenses.attach").attributes[SEMATTRS_AUTUMN_SUCCESS]).toBe(true);
    });

    it("records SDK errors on the span", async () => {
      const { client } = createRealClient({});
      instrumentAutumn(client);

      await expect(client.customers.get({ customerId: "cus_1" })).rejects.toThrow();

      const span = findSpan("autumn.customers.get");
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.attributes[SEMATTRS_AUTUMN_CUSTOMER_ID]).toBe("cus_1");
    });
  });
});
