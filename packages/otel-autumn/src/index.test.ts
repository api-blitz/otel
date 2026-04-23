import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  instrumentAutumn,
  SEMATTRS_AUTUMN_ALLOWED,
  SEMATTRS_AUTUMN_BALANCE,
  SEMATTRS_AUTUMN_CANCEL_ACTION,
  SEMATTRS_AUTUMN_CARRY_OVER_BALANCES,
  SEMATTRS_AUTUMN_CUSTOMER_ID,
  SEMATTRS_AUTUMN_ENTITY_FEATURE_ID,
  SEMATTRS_AUTUMN_ENTITY_ID,
  SEMATTRS_AUTUMN_EVENT_COUNT,
  SEMATTRS_AUTUMN_FEATURE_ID,
  SEMATTRS_AUTUMN_FLAG_ID,
  SEMATTRS_AUTUMN_HAS_PAYMENT_URL,
  SEMATTRS_AUTUMN_HAS_PORTAL_URL,
  SEMATTRS_AUTUMN_HAS_PREVIEW,
  SEMATTRS_AUTUMN_INVOICE_ID,
  SEMATTRS_AUTUMN_INVOICE_MODE,
  SEMATTRS_AUTUMN_PAYMENT_URL,
  SEMATTRS_AUTUMN_PLAN_COUNT,
  SEMATTRS_AUTUMN_PLAN_ID,
  SEMATTRS_AUTUMN_PLAN_IDS,
  SEMATTRS_AUTUMN_REFERRAL_CODE,
  SEMATTRS_AUTUMN_REQUIRED_BALANCE,
  SEMATTRS_AUTUMN_RESOURCE,
  SEMATTRS_AUTUMN_SEND_EVENT,
  SEMATTRS_AUTUMN_TARGET,
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

describe("@kubiks/otel-autumn", () => {
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
});
