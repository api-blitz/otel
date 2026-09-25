/**
 * Runs `instrumentDrizzleClient` against real drizzle-orm releases (installed under npm
 * aliases) to make sure every supported version produces exactly one span per query.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { PGlite } from "@electric-sql/pglite";
import initSqlJs from "sql.js";
import { instrumentDrizzleClient } from "./index";

interface DrizzleVersion {
  label: string;
  pkg: string;
  /** drizzle-orm >= 1.0 (relations v2, object-only driver config) */
  v1: boolean;
  /** Has pglite / mysql-proxy / sqlite-proxy batch / withReplicas */
  modern: boolean;
}

const VERSIONS: DrizzleVersion[] = [
  { label: "0.28", pkg: "drizzle-orm-0.28", v1: false, modern: false },
  { label: "0.36", pkg: "drizzle-orm-0.36", v1: false, modern: true },
  { label: "0.45 (latest)", pkg: "drizzle-orm", v1: false, modern: true },
  { label: "1.0 (rc)", pkg: "drizzle-orm-1", v1: true, modern: true },
];

const load = (pkg: string, path = ""): Promise<any> => import(`${pkg}${path}`);

let provider: BasicTracerProvider;
let exporter: InMemorySpanExporter;

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
  context.disable();
});

function takeSpans(): ReadableSpan[] {
  const spans = [...exporter.getFinishedSpans()];
  exporter.reset();
  return spans;
}

function summarize(spans: ReadableSpan[]) {
  return spans.map((span) => ({
    name: span.name,
    statement: span.attributes["db.statement"],
    transaction: span.attributes["db.transaction"] ?? false,
  }));
}

/** Minimal postgres.js client: records SQL, returns empty results, fails on "nope". */
function createFakePostgresJs(): any {
  const client: any = {
    options: { parsers: {}, serializers: {} },
    unsafe(query: string) {
      const run = () =>
        query.includes("nope")
          ? Promise.reject(new Error(`column "nope" does not exist`))
          : Promise.resolve([]);
      return {
        then: (resolve: any, reject: any) => run().then(resolve, reject),
        values: run,
      };
    },
    begin: (callback: (tx: unknown) => unknown) =>
      Promise.resolve().then(() => callback(createFakePostgresJs())),
    savepoint: (callback: (tx: unknown) => unknown) =>
      Promise.resolve().then(() => callback(createFakePostgresJs())),
  };
  return client;
}

describe.each(VERSIONS)("drizzle-orm $label", (version) => {
  describe("postgres-js", () => {
    async function setup() {
      const { pgTable, serial, text } = await load(version.pkg, "/pg-core");
      const { drizzle } = await load(version.pkg, "/postgres-js");
      const { sql } = await load(version.pkg);
      const users = pgTable("users", {
        id: serial("id").primaryKey(),
        name: text("name"),
      });
      const client = createFakePostgresJs();
      const db =
        version.label === "0.28" ? drizzle(client) : drizzle({ client });
      instrumentDrizzleClient(db);
      return { db, users, sql };
    }

    it("traces query builders and raw SQL once each", async () => {
      const { db, users, sql } = await setup();

      await db.select().from(users);
      await db.insert(users).values({ name: "ada" });
      await db.update(users).set({ name: "grace" });
      await db.delete(users);
      await db.execute(sql`select 1`);

      expect(summarize(takeSpans())).toEqual([
        {
          name: "drizzle.select",
          statement: 'select "id", "name" from "users"',
          transaction: false,
        },
        {
          name: "drizzle.insert",
          statement: 'insert into "users" ("id", "name") values (default, $1)',
          transaction: false,
        },
        {
          name: "drizzle.update",
          statement: 'update "users" set "name" = $1',
          transaction: false,
        },
        {
          name: "drizzle.delete",
          statement: 'delete from "users"',
          transaction: false,
        },
        { name: "drizzle.select", statement: "select 1", transaction: false },
      ]);
    });

    it("traces transactions and savepoints without duplicate spans", async () => {
      const { db, users, sql } = await setup();

      const result = await db.transaction(async (tx: any) => {
        await tx.execute(sql`set local role app_user`);
        await tx.select().from(users);
        await tx.transaction(async (nested: any) => {
          await nested.insert(users).values({ name: "nested" });
        });
        return "done";
      });
      await db.select().from(users);

      expect(result).toBe("done");
      expect(
        summarize(takeSpans()).map(({ name, transaction }) => ({
          name,
          transaction,
        })),
      ).toEqual([
        { name: "drizzle.set", transaction: true },
        { name: "drizzle.select", transaction: true },
        { name: "drizzle.insert", transaction: true },
        { name: "drizzle.select", transaction: false },
      ]);
    });

    it("records failed queries", async () => {
      const { db, sql } = await setup();

      await expect(db.execute(sql`select nope from users`)).rejects.toThrow();

      const spans = takeSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.events.some((e) => e.name === "exception")).toBe(true);
    });

    it("is idempotent", async () => {
      const { db, users } = await setup();

      instrumentDrizzleClient(db);
      instrumentDrizzleClient(db, { dbSystem: "other" });
      await db.select().from(users);

      expect(takeSpans()).toHaveLength(1);
    });
  });

  describe("sql.js (sync SQLite)", () => {
    async function setup() {
      const { sqliteTable, integer, text } = await load(
        version.pkg,
        "/sqlite-core",
      );
      const { drizzle } = await load(version.pkg, "/sql-js");
      const { sql } = await load(version.pkg);
      const SQL = await initSqlJs();
      const client = new SQL.Database();
      client.run("create table t (id integer primary key, name text)");
      const t = sqliteTable("t", {
        id: integer("id").primaryKey(),
        name: text("name"),
      });
      const db = drizzle(client);
      instrumentDrizzleClient(db, { dbSystem: "sqlite" });
      return { db, t, sql };
    }

    it("keeps the sync API and traces run/all/get/values", async () => {
      const { db, t } = await setup();

      const runResult = db.insert(t).values({ name: "ada" }).run();
      const rows = db.select().from(t).all();
      const row = db.select().from(t).get();
      const values = db.select().from(t).values();

      expect(typeof runResult?.then).not.toBe("function");
      expect(rows).toEqual([{ id: 1, name: "ada" }]);
      expect(row).toEqual({ id: 1, name: "ada" });
      expect(values).toEqual([[1, "ada"]]);
      expect(takeSpans().map((span) => span.name)).toEqual([
        "drizzle.insert",
        "drizzle.select",
        "drizzle.select",
        "drizzle.select",
      ]);

      expect(await db.select().from(t)).toEqual([{ id: 1, name: "ada" }]);
      expect(takeSpans()).toHaveLength(1);
    });

    it("supports sync transactions", async () => {
      const { db, t } = await setup();

      const result = db.transaction((tx: any) => {
        tx.insert(t).values({ name: "grace" }).run();
        return tx.select().from(t).all();
      });
      db.select().from(t).all();

      expect(result).toEqual([{ id: 1, name: "grace" }]);
      expect(
        summarize(takeSpans()).map(({ name, transaction }) => ({
          name,
          transaction,
        })),
      ).toEqual([
        // sql.js issues `begin` / `commit` through drizzle itself
        { name: "drizzle.begin", transaction: true },
        { name: "drizzle.insert", transaction: true },
        { name: "drizzle.select", transaction: true },
        { name: "drizzle.commit", transaction: true },
        { name: "drizzle.select", transaction: false },
      ]);
    });

    it("records statements that fail to prepare", async () => {
      const { db, sql } = await setup();

      expect(() => db.run(sql`select nope from t`)).toThrow();

      const spans = takeSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe("drizzle.select");
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe.runIf(version.modern)("pglite", () => {
    async function setup() {
      const { pgTable, serial, text, withReplicas } = await load(
        version.pkg,
        "/pg-core",
      );
      const { drizzle } = await load(version.pkg, "/pglite");
      const orm = await load(version.pkg);
      const users = pgTable("users", {
        id: serial("id").primaryKey(),
        name: text("name"),
      });
      const client = new PGlite();
      await client.exec(
        "create table users (id serial primary key, name text)",
      );
      const db = version.v1
        ? drizzle({ client, relations: orm.defineRelations({ users }) })
        : drizzle({ client, schema: { users } });
      return { db, users, client, drizzle, withReplicas, sql: orm.sql };
    }

    it("traces queries, relational queries and transactions", async () => {
      const { db, users, sql } = await setup();
      instrumentDrizzleClient(db);

      await db.insert(users).values({ name: "ada" });
      expect(await db.query.users.findMany()).toEqual([{ id: 1, name: "ada" }]);
      await db.transaction(async (tx: any) => {
        await tx.execute(sql`select 1`);
        await tx.transaction(async (nested: any) => {
          await nested.select().from(users);
        });
      });

      expect(
        summarize(takeSpans()).map(({ name, transaction }) => ({
          name,
          transaction,
        })),
      ).toEqual([
        { name: "drizzle.insert", transaction: false },
        { name: "drizzle.select", transaction: false },
        { name: "drizzle.select", transaction: true },
        { name: "drizzle.savepoint", transaction: true },
        { name: "drizzle.select", transaction: true },
        { name: "drizzle.release", transaction: true },
      ]);
    });

    it("instruments read replicas", async () => {
      const {
        db: primary,
        users,
        client,
        drizzle,
        withReplicas,
      } = await setup();
      const replica = drizzle({ client });
      const db = withReplicas(primary, [replica]);
      if (!("$replicas" in db)) {
        // drizzle-orm < 0.45 doesn't expose replicas; instrument them directly
        instrumentDrizzleClient(replica);
      }
      instrumentDrizzleClient(db);

      await db.select().from(users);
      await db.insert(users).values({ name: "ada" });

      expect(takeSpans().map((span) => span.name)).toEqual([
        "drizzle.select",
        "drizzle.insert",
      ]);
    });
  });

  describe.runIf(version.modern)("mysql-proxy", () => {
    it("traces queries", async () => {
      const { mysqlTable, int, text } = await load(version.pkg, "/mysql-core");
      const { drizzle } = await load(version.pkg, "/mysql-proxy");
      const { sql } = await load(version.pkg);
      const m = mysqlTable("m", {
        id: int("id").primaryKey(),
        name: text("name"),
      });
      const db = drizzle(
        async (_sql: string, _params: unknown[], method: string) => ({
          rows: method === "all" ? [] : [{ insertId: 1, affectedRows: 1 }],
        }),
      );
      instrumentDrizzleClient(db, { dbSystem: "mysql" });

      await db.select().from(m);
      await db.insert(m).values({ id: 1, name: "ada" });
      await db.execute(sql`select 1`);

      const spans = takeSpans();
      expect(spans.map((span) => span.name)).toEqual([
        "drizzle.select",
        "drizzle.insert",
        "drizzle.select",
      ]);
      expect(spans[0]?.attributes["db.system"]).toBe("mysql");
    });
  });

  describe.runIf(version.modern)("sqlite-proxy with a context manager", () => {
    it("nests spans under the caller and flags the driver's begin/commit", async () => {
      context.setGlobalContextManager(
        new AsyncLocalStorageContextManager().enable(),
      );
      const { sqliteTable, integer, text } = await load(
        version.pkg,
        "/sqlite-core",
      );
      const { drizzle } = await load(version.pkg, "/sqlite-proxy");
      const t = sqliteTable("t", {
        id: integer("id").primaryKey(),
        name: text("name"),
      });
      const db = drizzle(async () => ({ rows: [] }));
      instrumentDrizzleClient(db, { dbSystem: "sqlite" });

      await trace
        .getTracer("app")
        .startActiveSpan("request", async (request) => {
          await Promise.all([
            db.transaction(async (tx: any) => {
              await tx.insert(t).values({ name: "ada" });
            }),
            db.select().from(t),
          ]);
          request.end();
        });

      const spans = takeSpans();
      const request = spans.find((span) => span.name === "request");
      const queries = spans.filter((span) => span !== request);
      expect(
        queries.map((span) => [
          span.name,
          span.attributes["db.transaction"] ?? false,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ["drizzle.begin", true],
          ["drizzle.insert", true],
          ["drizzle.commit", true],
          ["drizzle.select", false],
        ]),
      );
      expect(queries).toHaveLength(4);
      for (const span of queries) {
        expect(span.parentSpanContext?.spanId).toBe(
          request?.spanContext().spanId,
        );
      }
    });
  });

  describe.runIf(version.modern)("sqlite-proxy batch", () => {
    it("traces a batch as one span", async () => {
      const { sqliteTable, integer, text } = await load(
        version.pkg,
        "/sqlite-core",
      );
      const { drizzle } = await load(version.pkg, "/sqlite-proxy");
      const t = sqliteTable("t", {
        id: integer("id").primaryKey(),
        name: text("name"),
      });
      const db = drizzle(
        async () => ({ rows: [] }),
        async (queries: unknown[]) => queries.map(() => ({ rows: [] })),
      );
      instrumentDrizzleClient(db, { dbSystem: "sqlite" });

      await db.batch([
        db.insert(t).values({ name: "ada" }),
        db.select().from(t),
      ]);

      const spans = takeSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe("drizzle.batch");
      expect(spans[0]?.attributes["db.operation.batch.size"]).toBe(2);
      expect(spans[0]?.attributes["db.statement"]).toBe(
        'insert into "t" ("id", "name") values (null, ?);\nselect "id", "name" from "t"',
      );
    });
  });
});
