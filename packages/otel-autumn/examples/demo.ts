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
    trackTokens: async (_args: unknown) => ({
      customerId: "cus_demo",
      value: 12.5,
      balance: { featureId: "ai_credits", remaining: 987.5 },
      deductions: [{ balanceId: "bal_demo", featureId: "ai_credits", planId: "pro", reset: null, value: 12.5 }],
    }),
    batchTrack: async (_args: unknown) => ({ success: true }),
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
      multiUpdate: async (_args: unknown) => ({ customerId: "cus_demo", paymentUrl: null }),
      previewMultiUpdate: async (_args: unknown) => ({
        customerId: "cus_demo",
        currency: "usd",
        total: 750,
        subscriptions: [],
      }),
      createSchedule: async (_args: unknown) => ({
        customerId: "cus_demo",
        entityId: null,
        status: "created",
        scheduleId: "sched_demo",
        phases: [
          { phaseId: "ph_1", startsAt: 1700000000000, customerProductIds: [] },
          { phaseId: "ph_2", startsAt: 1702592000000, customerProductIds: [] },
        ],
        paymentUrl: null,
      }),
      import: async (_args: unknown) => ({
        customerId: "cus_demo",
        flashed: [{ planId: "pro", processor: "stripe", customerProductId: "cp_demo", status: "active", skipped: false }],
        customer: null,
      }),
    },
    customers: {
      getOrCreate: async (_args: unknown) => ({ id: "cus_demo", name: "Ada", email: "ada@example.com" }),
      get: async (_args: unknown) => ({ id: "cus_demo", name: "Ada" }),
      list: async () => ({ list: [{ id: "cus_demo" }, { id: "cus_demo_2" }], nextCursor: null }),
      update: async (_args: unknown) => ({ id: "cus_demo" }),
      delete: async (_args: unknown) => ({ id: "cus_demo" }),
      advanceTestClock: async (_args: unknown) => ({
        customerId: "cus_demo",
        frozenTime: 1800000000000,
        status: "advancing",
      }),
    },
    entities: {
      create: async (_args: unknown) => ({ id: "seat_demo", customerId: "cus_demo", featureId: "seats" }),
      get: async (_args: unknown) => ({ id: "seat_demo", customerId: "cus_demo", featureId: "seats" }),
      list: async (_args: unknown) => ({ list: [{ id: "seat_demo" }], nextCursor: null }),
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
      createProgram: async (_args: unknown) => ({ id: "prog_demo", rewardId: "rew_demo" }),
      listPrograms: async () => ({ list: [{ id: "prog_demo" }] }),
      getProgram: async (_args: unknown) => ({ id: "prog_demo", rewardId: "rew_demo" }),
      updateProgram: async (_args: unknown) => ({ id: "prog_demo", rewardId: "rew_demo" }),
      deleteProgram: async (_args: unknown) => ({ success: true }),
    },
    invoices: {
      create: async (_args: unknown) => ({
        invoice: {
          id: "inv_demo",
          stripeId: "in_demo_3",
          status: "open",
          total: 4200,
          currency: "usd",
          customerId: "cus_demo",
          entityId: null,
          planIds: ["pro"],
        },
        preview: { currency: "usd", total: 4200 },
      }),
      insert: async (_args: unknown) => ({ invoices: [{ id: "inv_demo_2" }, { id: "inv_demo_3" }] }),
      list: async (_args: unknown) => ({ list: [{ id: "inv_demo" }], nextCursor: null }),
      listTemplates: async (_args: unknown) => ({ list: [], total: 0, limit: 10, offset: 0, hasMore: false }),
      pay: async (_args: unknown) => ({
        invoice: { id: "inv_demo", stripeId: "in_demo_3", status: "paid", total: 4200, currency: "usd" },
      }),
      reissue: async (_args: unknown) => ({
        invoice: null,
        voidedInvoiceId: null,
        creditNoteId: null,
        preview: { currency: "usd", total: 3900 },
      }),
      void: async (_args: unknown) => ({
        invoice: { id: "inv_demo", stripeId: "in_demo_3", status: "void", total: 4200, currency: "usd" },
      }),
    },
    licenses: {
      attach: async (_args: unknown) => ({ success: true }),
      release: async (_args: unknown) => ({ success: true }),
    },
    rewards: {
      create: async (_args: unknown) => ({ coupon: { id: "rew_demo", promoCodes: [{ code: "SAVE50" }] } }),
      list: async () => ({ coupons: [{ id: "rew_demo" }], featureGrants: [{ id: "rew_grant_demo" }] }),
      get: async (_args: unknown) => ({ coupon: { id: "rew_demo" } }),
      update: async (_args: unknown) => ({ coupon: { id: "rew_demo" } }),
      delete: async (_args: unknown) => ({ success: true }),
      redeemCode: async (_args: unknown) => ({
        rewardId: "rew_grant_demo",
        entitlementsGranted: [{ featureId: "messages", balance: 100 }],
      }),
    },
    keys: {
      mint: async (_args: unknown) => ({ accessToken: "demo_access", refreshToken: "demo_refresh", expiresAt: null }),
      refresh: async (_args: unknown) => ({ accessToken: "demo_access_2", expiresAt: null }),
      revoke: async (_args: unknown) => ({ revoked: true }),
    },
    logs: {
      search: async (_args: unknown) => ({ list: [{ id: "log_1" }, { id: "log_2" }] }),
    },
    platform: {
      getStripeConnection: async (_args: unknown) => ({ connected: true, accountId: "acct_demo", connectedAt: 1700000000000 }),
      disconnectStripe: async (_args: unknown) => ({ success: true }),
      linkRevenueCat: async (_args: unknown) => ({ oauthUrl: "https://app.revenuecat.com/oauth/demo" }),
      syncRevenueCat: async (_args: unknown) => ({ results: [{}, {}] }),
      getRevenueCatKeys: async (_args: unknown) => ({ apps: [], oauthAccessToken: "demo_oauth" }),
    },
    sandboxes: {
      create: async (_args: unknown) => ({ id: "sbx_demo", name: "QA", slug: "qa", secretKey: "am_sk_test_demo" }),
      list: async (_args: unknown) => ({ list: [{ id: "sbx_demo" }] }),
      delete: async (_args: unknown) => ({ success: true }),
      reset: async (_args: unknown) => ({ success: true }),
    },
  };
}

async function main() {
  const provider = setupOtel("otel-autumn-demo");

  const client = createMockAutumnClient();
  instrumentAutumn(client as never, { captureCustomerData: true });

  // --- Top-level (4) ---
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

  await client.trackTokens({
    customerId: "cus_demo",
    modelId: "anthropic/claude-opus-4-8",
    inputTokens: 1200,
    outputTokens: 340,
    cacheReadTokens: 800,
    reasoningTokens: 50,
  } as never);

  await client.batchTrack([
    { customerId: "cus_demo", featureId: "messages", value: 1 },
    { customerId: "cus_demo", featureId: "api_calls", value: 5 },
  ] as never);

  // --- billing (12) ---
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

  await client.billing.multiUpdate({
    customerId: "cus_demo",
    updates: [
      { planId: "pro", cancelAction: "cancel_end_of_cycle" },
      { planId: "addon_seats", cancelAction: "cancel_immediately" },
    ],
  } as never);

  await client.billing.previewMultiUpdate({
    customerId: "cus_demo",
    updates: [{ planId: "pro", cancelAction: "cancel_end_of_cycle" }],
  } as never);

  await client.billing.createSchedule({
    customerId: "cus_demo",
    billingBehavior: "prorate_immediately",
    phases: [
      { plans: [{ planId: "starter" }] },
      { startsAt: 1702592000000, plans: [{ planId: "pro" }, { planId: "addon_seats" }] },
    ],
  } as never);

  await client.billing.import({
    customerId: "cus_demo",
    billables: [{ processor: "stripe" }],
    dryRun: true,
  } as never);

  // --- customers (6) ---
  await client.customers.getOrCreate({
    id: "cus_demo",
    email: "ada@example.com",
  } as never);
  await client.customers.get({ customerId: "cus_demo" } as never);
  await client.customers.list();
  await client.customers.update({ id: "cus_demo" } as never);
  await client.customers.delete({ id: "cus_demo" } as never);
  await client.customers.advanceTestClock({
    customerId: "cus_demo",
    frozenTime: 1800000000000,
  } as never);

  // --- entities (5) ---
  await client.entities.create({
    customerId: "cus_demo",
    entityId: "seat_demo",
    featureId: "seats",
    name: "Seat 1",
  } as never);
  await client.entities.get({ entityId: "seat_demo" } as never);
  await client.entities.list({ customerId: "cus_demo" } as never);
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

  // --- referrals (7) ---
  await client.referrals.createCode({
    customerId: "cus_demo",
    programId: "prog_demo",
  } as never);
  await client.referrals.redeemCode({
    customerId: "cus_demo",
    code: "REF123",
  } as never);
  await client.referrals.createProgram({
    id: "prog_demo",
    rewardId: "rew_demo",
    redeemOn: "checkout",
    receivedBy: "all",
  } as never);
  await client.referrals.listPrograms();
  await client.referrals.getProgram({ referralProgramId: "prog_demo" } as never);
  await client.referrals.updateProgram({ referralProgramId: "prog_demo", maxRedemptions: 10 } as never);
  await client.referrals.deleteProgram({ referralProgramId: "prog_demo" } as never);

  // --- invoices (7) ---
  await client.invoices.create({
    customerId: "cus_demo",
    plans: [{ planId: "pro" }],
  } as never);
  await client.invoices.insert({ invoices: [{}, {}] } as never);
  await client.invoices.list({ customerId: "cus_demo" } as never);
  await client.invoices.listTemplates({} as never);
  await client.invoices.pay({ invoiceId: "inv_demo" } as never);
  await client.invoices.reissue({ invoiceId: "inv_demo", preview: true } as never);
  await client.invoices.void({ invoiceId: "inv_demo" } as never);

  // --- licenses (2) ---
  await client.licenses.attach({
    customerId: "cus_demo",
    planId: "team",
    entities: [{ entityId: "seat_demo" }, { entityId: "seat_demo_2" }],
  } as never);
  await client.licenses.release({
    customerId: "cus_demo",
    licensePlanId: "team",
    entityIds: ["seat_demo_2"],
  } as never);

  // --- rewards (6) ---
  await client.rewards.create({ coupon: { name: "50% off" } } as never);
  await client.rewards.list();
  await client.rewards.get({ rewardId: "rew_demo" } as never);
  await client.rewards.update({ rewardId: "rew_demo" } as never);
  await client.rewards.delete({ rewardId: "rew_demo" } as never);
  await client.rewards.redeemCode({ customerId: "cus_demo", code: "SAVE50" } as never);

  // --- keys (3) — token responses are never recorded ---
  await client.keys.mint({ customerId: "cus_demo" } as never);
  await client.keys.refresh({} as never);
  await client.keys.revoke({ customerId: "cus_demo" } as never);

  // --- logs (1) ---
  await client.logs.search({ query: "customer:cus_demo", limit: 10 } as never);

  // --- platform (5) ---
  const org = { organizationSlug: "acme", env: "sandbox" };
  await client.platform.getStripeConnection(org as never);
  await client.platform.disconnectStripe(org as never);
  await client.platform.linkRevenueCat({ ...org, projectName: "app", redirectUrl: "https://acme.dev" } as never);
  await client.platform.syncRevenueCat(org as never);
  await client.platform.getRevenueCatKeys(org as never);

  // --- sandboxes (4) ---
  await client.sandboxes.create({ name: "QA" } as never);
  await client.sandboxes.list({} as never);
  await client.sandboxes.delete({ id: "sbx_demo" } as never);
  await client.sandboxes.reset({} as never);

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
    "Demo complete. 79 spans exported. Open http://localhost:16686 and pick service 'otel-autumn-demo'.",
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
