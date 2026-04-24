import { instrumentAutumn } from "../src/index";
import { setupOtel } from "./otel-setup";

function createMockAutumnClient() {
  return {
    check: async (_args: unknown) => ({
      allowed: true,
      customerId: "cus_demo",
      featureId: "messages",
      balance: {
        featureId: "messages",
        remaining: 42,
        granted: 100,
        usage: 58,
        unlimited: false,
        overageAllowed: false,
        maxPurchase: null,
        nextResetAt: null,
        feature: { name: "Messages", type: "metered" },
      },
      flag: { id: "flag_demo", planId: "pro", featureId: "messages", expiresAt: null },
      preview: { scenario: "upgrade" },
    }),
    track: async (_args: unknown) => ({
      customerId: "cus_demo",
      featureId: "messages",
      eventName: "message_sent",
      value: 1,
      balance: {
        featureId: "messages",
        remaining: 41,
        granted: 100,
        usage: 59,
      },
      balances: { messages: { remaining: 41 }, api_calls: { remaining: 900 } },
    }),
    billing: {
      attach: async (_args: unknown) => ({
        customerId: "cus_demo",
        paymentUrl: "https://checkout.stripe.com/pay/cs_demo",
        invoice: {
          stripeId: "in_demo",
          status: "paid",
          total: 2000,
          currency: "usd",
          hostedInvoiceUrl: "https://invoice.stripe.com/demo",
        },
        requiredAction: { code: "none" },
      }),
      multiAttach: async (_args: unknown) => ({
        customerId: "cus_demo",
        paymentUrl: null,
      }),
      previewAttach: async (_args: unknown) => ({
        customerId: "cus_demo",
        total: 2000,
        currency: "usd",
        hasProrations: true,
      }),
      previewMultiAttach: async (_args: unknown) => ({
        customerId: "cus_demo",
        total: 5000,
        currency: "usd",
        hasProrations: false,
      }),
      update: async (_args: unknown) => ({
        customerId: "cus_demo",
        paymentUrl: null,
        invoice: { stripeId: "in_demo_2", status: "draft", total: 500, currency: "usd" },
      }),
      previewUpdate: async (_args: unknown) => ({
        customerId: "cus_demo",
        total: 1000,
        currency: "usd",
        hasProrations: true,
      }),
      openCustomerPortal: async (_args: unknown) => ({
        customerId: "cus_demo",
        url: "https://billing.stripe.com/session/demo",
      }),
      setupPayment: async (_args: unknown) => ({
        customerId: "cus_demo",
        url: "https://checkout.stripe.com/setup/cs_demo",
      }),
    },
    customers: {
      getOrCreate: async (_args: unknown) => ({ id: "cus_demo", name: "Ada", email: "ada@example.com" }),
      list: async () => ({ items: [{ id: "cus_demo" }, { id: "cus_demo_2" }] }),
      update: async (_args: unknown) => ({ id: "cus_demo" }),
      delete: async (_args: unknown) => ({ id: "cus_demo" }),
    },
    entities: {
      create: async (_args: unknown) => ({ id: "seat_demo", customerId: "cus_demo", featureId: "seats" }),
      get: async (_args: unknown) => ({ id: "seat_demo", customerId: "cus_demo", featureId: "seats" }),
      update: async (_args: unknown) => ({ id: "seat_demo", customerId: "cus_demo", featureId: "seats" }),
      delete: async (_args: unknown) => ({ id: "seat_demo", customerId: "cus_demo", featureId: "seats" }),
    },
    balances: {
      create: async (_args: unknown) => ({ featureId: "messages", remaining: 10 }),
      update: async (_args: unknown) => ({ featureId: "messages", remaining: 20 }),
      delete: async (_args: unknown) => ({ featureId: "messages", remaining: 0 }),
      finalize: async (_args: unknown) => ({ featureId: "messages", remaining: 15 }),
    },
    events: {
      list: async (_args: unknown) => ({
        list: [{ id: "evt_1" }, { id: "evt_2" }, { id: "evt_3" }],
        hasMore: false,
        offset: 0,
        limit: 50,
        total: 3,
      }),
      aggregate: async (_args: unknown) => ({
        list: [
          { period: 1700000000000, values: { messages: 512 } },
          { period: 1700086400000, values: { messages: 1024 } },
        ],
        total: { messages: { count: 2, sum: 1536 }, api_calls: { count: 5, sum: 42 } },
      }),
    },
    plans: {
      create: async (_args: unknown) => ({ planId: "pro", id: "pro", name: "Pro" }),
      get: async (_args: unknown) => ({ planId: "pro", id: "pro", name: "Pro" }),
      list: async () => ({ items: [{ id: "pro" }, { id: "starter" }] }),
      update: async (_args: unknown) => ({ planId: "pro", id: "pro", name: "Pro (Updated)" }),
      delete: async (_args: unknown) => ({ planId: "pro", id: "pro" }),
    },
    features: {
      create: async (_args: unknown) => ({ featureId: "messages", id: "messages", name: "Messages", type: "metered" }),
      get: async (_args: unknown) => ({ featureId: "messages", id: "messages", name: "Messages", type: "metered" }),
      list: async () => ({ items: [{ id: "messages" }, { id: "api_calls" }] }),
      update: async (_args: unknown) => ({ featureId: "messages", id: "messages", name: "Messages v2", type: "metered" }),
      delete: async (_args: unknown) => ({ featureId: "messages", id: "messages" }),
    },
    referrals: {
      createCode: async (_args: unknown) => ({ code: "REF123", programId: "prog_demo" }),
      redeemCode: async (_args: unknown) => ({ code: "REF123", programId: "prog_demo" }),
    },
  };
}

async function main() {
  const provider = setupOtel("otel-autumn-demo");

  const client = createMockAutumnClient();
  instrumentAutumn(client as never, { captureCustomerData: true });

  // --- Top-level (2) ---
  await client.check({
    customerId: "cus_demo",
    featureId: "messages",
    requiredBalance: 3,
    sendEvent: true,
    withPreview: true,
  } as never);

  await client.track({
    customerId: "cus_demo",
    featureId: "messages",
    eventName: "message_sent",
    value: 1,
  } as never);

  // --- billing (8) ---
  await client.billing.attach({
    customerId: "cus_demo",
    planId: "pro",
    version: 2,
    invoiceMode: { enabled: true },
    prorationBehavior: "create_prorations",
    redirectMode: "return_url",
    carryOverBalances: { enabled: true, featureIds: ["messages"] },
    carryOverUsages: { enabled: false },
    noBillingChanges: false,
    newBillingSubscription: true,
    featureQuantities: [
      { featureId: "seats", quantity: 5 },
      { featureId: "api_calls", quantity: 10_000 },
    ],
    discounts: [{ code: "SAVE10" }],
  } as never);

  await client.billing.multiAttach({
    customerId: "cus_demo",
    plans: [{ planId: "pro" }, { planId: "addon_seats" }],
    invoiceMode: { enabled: false },
    redirectMode: "return_url",
    newBillingSubscription: false,
    discounts: [],
  } as never);

  await client.billing.previewAttach({
    customerId: "cus_demo",
    planId: "pro",
  } as never);

  await client.billing.previewMultiAttach({
    customerId: "cus_demo",
    plans: [{ planId: "pro" }],
  } as never);

  await client.billing.update({
    customerId: "cus_demo",
    planId: "pro",
    cancelAction: "cancel_end_of_cycle",
    prorationBehavior: "none",
    version: 3,
    featureQuantities: [{ featureId: "seats", quantity: 10 }],
  } as never);

  await client.billing.previewUpdate({
    customerId: "cus_demo",
    planId: "pro",
  } as never);

  await client.billing.openCustomerPortal({ customerId: "cus_demo" } as never);

  await client.billing.setupPayment({ customerId: "cus_demo" } as never);

  // --- customers (4) ---
  await client.customers.getOrCreate({
    id: "cus_demo",
    email: "ada@example.com",
  } as never);
  await client.customers.list();
  await client.customers.update({ id: "cus_demo" } as never);
  await client.customers.delete({ id: "cus_demo" } as never);

  // --- entities (4) ---
  await client.entities.create({
    customerId: "cus_demo",
    entityId: "seat_demo",
    featureId: "seats",
    name: "Seat 1",
  } as never);
  await client.entities.get({ entityId: "seat_demo" } as never);
  await client.entities.update({ entityId: "seat_demo" } as never);
  await client.entities.delete({ entityId: "seat_demo" } as never);

  // --- balances (4) ---
  await client.balances.create({
    customerId: "cus_demo",
    featureId: "messages",
    value: 10,
  } as never);
  await client.balances.update({
    customerId: "cus_demo",
    featureId: "messages",
    value: 20,
  } as never);
  await client.balances.delete({
    customerId: "cus_demo",
    featureId: "messages",
  } as never);
  await client.balances.finalize({
    customerId: "cus_demo",
    featureId: "messages",
    lockId: "lock_demo",
  } as never);

  // --- events (2) ---
  await client.events.list({
    customerId: "cus_demo",
    featureId: "messages",
  } as never);
  await client.events.aggregate({
    customerId: "cus_demo",
    range: "7d",
  } as never);

  // --- plans (5) ---
  await client.plans.create({ planId: "pro", name: "Pro" } as never);
  await client.plans.get({ planId: "pro" } as never);
  await client.plans.list();
  await client.plans.update({ planId: "pro", name: "Pro v2" } as never);
  await client.plans.delete({ planId: "pro" } as never);

  // --- features (5) ---
  await client.features.create({
    featureId: "messages",
    name: "Messages",
    type: "metered",
  } as never);
  await client.features.get({ featureId: "messages" } as never);
  await client.features.list();
  await client.features.update({ featureId: "messages", name: "Messages v2" } as never);
  await client.features.delete({ featureId: "messages" } as never);

  // --- referrals (2) ---
  await client.referrals.createCode({
    customerId: "cus_demo",
    programId: "prog_demo",
  } as never);
  await client.referrals.redeemCode({
    customerId: "cus_demo",
    code: "REF123",
  } as never);

  // --- Error path (1) ---
  const failing = {
    check: async () => {
      throw new Error("demo: feature not found");
    },
  };
  instrumentAutumn(failing as never);
  try {
    await failing.check();
  } catch {
    // expected — shows up as ERROR span in Jaeger
  }

  try {
    await provider.forceFlush();
    await provider.shutdown();
  } catch (err) {
    if (isConnRefused(err)) {
      console.error(
        "Could not reach the OTLP endpoint at http://localhost:4318. Is Jaeger running? Try `docker compose up -d` from the repo root.",
      );
      process.exit(1);
    }
    throw err;
  }

  console.log(
    "Demo complete. 37 spans exported. Open http://localhost:16686 and pick service 'otel-autumn-demo'.",
  );
}

function isConnRefused(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if (Array.isArray(err)) return err.some(isConnRefused);
  const e = err as { code?: string; errors?: unknown[]; cause?: unknown };
  if (e.code === "ECONNREFUSED") return true;
  if (Array.isArray(e.errors) && e.errors.some(isConnRefused)) return true;
  if (e.cause && isConnRefused(e.cause)) return true;
  return false;
}

main().catch((err) => {
  if (isConnRefused(err)) {
    console.error(
      "Could not reach the OTLP endpoint at http://localhost:4318. Is Jaeger running? Try `docker compose up -d` from the repo root.",
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
