import { instrumentDrizzle, instrumentDrizzleClient } from "../src/index";
import { setupOtel } from "./otel-setup";

type QueryFn = (...args: any[]) => unknown;

function extractText(q: unknown): string {
  if (typeof q === "string") return q;
  if (q && typeof q === "object") {
    const o = q as { sql?: unknown; text?: unknown };
    if (typeof o.sql === "string") return o.sql;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

/** Mock 1: a pg-style client with both `query` and `execute` methods. */
function createMockQueryClient(): { query: QueryFn; execute?: QueryFn } {
  return {
    query: (q: unknown, secondArg?: unknown) => {
      const text = extractText(q);
      // Callback-based pattern: last arg is a function
      if (typeof secondArg === "function") {
        const cb = secondArg as (err: unknown, res: unknown) => void;
        if (text.includes("nonexistent_column")) {
          cb(new Error("demo: column does not exist"), null);
          return undefined;
        }
        cb(null, { rows: [{ id: 1 }] });
        return undefined;
      }
      // Promise-based
      return (async () => {
        if (text.includes("nonexistent_column")) {
          throw new Error("demo: column does not exist");
        }
        return { rows: [{ id: 1 }] };
      })();
    },
  };
}

/** Mock 2: a libsql-style client that only has `execute`. */
function createMockExecuteClient(): { execute: QueryFn } {
  return {
    execute: async (q: unknown) => {
      const _text = extractText(q);
      return { rows: [{ id: 1 }] };
    },
  };
}

/** Mock 3: a db shape with session.prepareQuery (drizzle pg pattern). */
function createMockPrepareQueryDb() {
  const session = {
    prepareQuery: (queryObj: { sql: string }) => ({
      execute: async () => ({ rows: [{ id: 1 }] }),
      _queryObj: queryObj,
    }),
    query: async (_sql: string, _params: unknown[]) => ({ rows: [{ id: 1 }] }),
    transaction: async (cb: (tx: unknown) => unknown) => {
      const tx: any = {
        execute: async (_q: unknown) => ({ rows: [{ id: 1 }] }),
      };
      return cb(tx);
    },
  };
  return { session, select: () => undefined };
}

/** Mock 4: a db shape with $client (drizzle postgres-js pattern). */
function createMockDollarClientDb() {
  return {
    $client: createMockQueryClient(),
    select: () => undefined,
  };
}

/** Mock 5: a db shape with _.session.execute (drizzle mysql2 pattern). */
function createMockUnderscoreSessionDb() {
  return {
    _: {
      session: {
        execute: async (_q: unknown) => ({ rows: [{ id: 1 }] }),
      },
    },
    select: () => undefined,
  };
}

async function main() {
  const provider = setupOtel("otel-drizzle-demo");

  const config = {
    dbSystem: "postgresql",
    dbName: "demo",
    peerName: "localhost",
    peerPort: 5432,
  };

  // ============================================================
  // Phase 1 — instrumentDrizzle with `query` (promise-based)
  // All SQL verbs + long-query truncation + error path
  // ============================================================
  const q1 = instrumentDrizzle(createMockQueryClient(), config);

  // SQL verbs as plain strings
  await q1.query("SELECT id, email FROM users WHERE org_id = $1");
  await q1.query("INSERT INTO events (kind, payload) VALUES ($1, $2)");
  await q1.query("UPDATE users SET last_seen_at = now() WHERE id = $1");
  await q1.query("DELETE FROM sessions WHERE expires_at < now()");
  await q1.query("CREATE TABLE audits (id serial primary key, action text)");
  await q1.query("ALTER TABLE audits ADD COLUMN actor_id text");
  await q1.query("DROP TABLE audits");
  await q1.query("TRUNCATE TABLE events");
  await q1.query("BEGIN");
  await q1.query("COMMIT");
  await q1.query("SET LOCAL search_path TO public");
  await q1.query(
    "WITH recent AS (SELECT * FROM events ORDER BY created_at DESC LIMIT 10) SELECT * FROM recent",
  );

  // Query-object shapes
  await q1.query({
    sql: "INSERT INTO events (kind, payload) VALUES ($1, $2)",
    params: ["signup", { email: "ada@example.com" }],
  });
  await q1.query({
    text: "UPDATE users SET last_seen_at = now() WHERE id = $1",
    values: [1],
  });
  await q1.query({
    sql: "SELECT * FROM users LIMIT 1",
    queryChunks: ["SELECT * FROM users LIMIT 1"],
  });

  // Long query truncation (default maxQueryTextLength=1000 → appends "...")
  const longQuery = `SELECT ${"col_x, ".repeat(200)}id FROM big_table`;
  await q1.query(longQuery);

  // Error path (promise reject)
  try {
    await q1.query("SELECT nonexistent_column FROM users");
  } catch {
    // expected — ERROR span
  }

  // ============================================================
  // Phase 2 — instrumentDrizzle with callback pattern
  // ============================================================
  const q2 = instrumentDrizzle(createMockQueryClient(), config);

  await new Promise<void>((resolve) => {
    q2.query("SELECT id FROM users /* callback-success */", () => resolve());
  });

  await new Promise<void>((resolve) => {
    q2.query("SELECT nonexistent_column FROM users /* callback-error */", () =>
      resolve(),
    );
  });

  // ============================================================
  // Phase 3 — instrumentDrizzle with `execute` method
  // ============================================================
  const e1 = instrumentDrizzle(createMockExecuteClient(), config);
  await e1.execute?.("SELECT * FROM users WHERE id = $1 /* via execute */");
  await e1.execute?.({
    sql: "DELETE FROM users WHERE id = $1 /* via execute */",
    args: [1],
  });

  // ============================================================
  // Phase 4 — instrumentDrizzleClient: session.prepareQuery + session.query
  // ============================================================
  const db1 = instrumentDrizzleClient(createMockPrepareQueryDb(), config);

  const preparedSelect = db1.session.prepareQuery({
    sql: "SELECT * FROM users /* prepared */",
  });
  await preparedSelect.execute();

  const preparedInsert = db1.session.prepareQuery({
    sql: "INSERT INTO users (name) VALUES ($1) /* prepared */",
  });
  await preparedInsert.execute();

  await db1.session.query("UPDATE users SET name = $1 /* direct session */", [
    "Ada",
  ]);

  // ============================================================
  // Phase 5 — instrumentDrizzleClient: transaction path (tx.execute)
  // Verify db.transaction=true attribute is set
  // ============================================================
  await db1.session.transaction(async (tx: any) => {
    await tx.execute({ sql: "SET LOCAL role org_role /* in tx */" });
    await tx.execute({
      sql: "SELECT set_config('request.org_id', $1, true) /* in tx */",
      params: ["org_demo"],
    });
    await tx.execute({
      sql: "INSERT INTO org_audit (action) VALUES ($1) /* in tx */",
      params: ["demo"],
    });
  });

  // ============================================================
  // Phase 6 — instrumentDrizzleClient: $client fallback
  // ============================================================
  const db2 = instrumentDrizzleClient(createMockDollarClientDb(), config);
  await (db2.$client as { query: QueryFn }).query(
    "SELECT id FROM users /* via $client */",
  );

  // ============================================================
  // Phase 7 — instrumentDrizzleClient: _.session.execute fallback
  // ============================================================
  const db3 = instrumentDrizzleClient(createMockUnderscoreSessionDb(), config);
  await db3._.session.execute?.(
    "INSERT INTO users (name) VALUES ($1) /* via _.session */",
  );
  await db3._.session.execute?.(
    "DELETE FROM users WHERE id = $1 /* via _.session */",
  );

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
    "Demo complete. Open http://localhost:16686 and pick service 'otel-drizzle-demo'.",
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
