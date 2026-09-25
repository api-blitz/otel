import {
  context,
  createContextKey,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Span,
  type Tracer,
} from "@opentelemetry/api";

const DEFAULT_TRACER_NAME = "@api-blitz/otel-drizzle";
const DEFAULT_DB_SYSTEM = "postgresql";
const INSTRUMENTED_FLAG = "__apiBlitzOtelDrizzleInstrumented" as const;

// Hidden markers stored on drizzle sessions.
const TRANSACTION_SESSION_FLAG = "__apiBlitzOtelDrizzleTransactionSession";
const TRANSACTION_DEPTH = "__apiBlitzOtelDrizzleTransactionDepth";

// Marks our wrapper functions (value = the wrapped original) so nothing gets wrapped twice,
// even across multiple copies of this package.
const WRAPPED_MARK = Symbol.for("@api-blitz/otel-drizzle.wrapped");

// drizzle-orm tags its classes with `static [entityKind] = "<ClassName>"`.
const DRIZZLE_ENTITY_KIND = Symbol.for("drizzle:entityKind");

// Set while a callback passed to `db.transaction()` runs.
const TRANSACTION_CONTEXT_KEY = createContextKey(
  "@api-blitz/otel-drizzle.transaction",
);
// Holds the prepared query whose span is active, so internal delegation
// (e.g. SQLite `execute()` -> `all()`) doesn't produce duplicate spans.
const ACTIVE_QUERY_CONTEXT_KEY = createContextKey(
  "@api-blitz/otel-drizzle.active-query",
);

// Prepared query whose instrumented method is running synchronously right now. Covers the
// same internal delegation as ACTIVE_QUERY_CONTEXT_KEY when no context manager is registered.
let busyPrepared: object | undefined;
// True while a prepare wrapper runs; nested prepare calls
// (`prepareOneTimeQuery` -> `prepareQuery`) pass straight through to the outermost one.
let preparing = false;
// Collects the SQL of the queries a `batch()` call prepares (synchronously, before it awaits).
let batchStatements: string[] | undefined;

/**
 * Methods drizzle calls on a prepared query to run it. PostgreSQL / MySQL drivers use
 * `execute` (and `all`), SQLite drivers use `run` / `all` / `get` / `values`.
 */
const PREPARED_QUERY_METHODS = [
  "execute",
  "all",
  "get",
  "values",
  "run",
] as const;

/**
 * Session methods that build prepared queries. `prepareQuery` exists in every drizzle
 * version; `prepareOneTimeQuery` (SQLite, < 1.0) and `prepareRelationalQuery`
 * (SingleStore, >= 1.0) only in some.
 */
const PREPARE_METHODS = [
  "prepareQuery",
  "prepareOneTimeQuery",
  "prepareRelationalQuery",
] as const;

// Semantic conventions for database attributes
export const SEMATTRS_DB_SYSTEM = "db.system";
export const SEMATTRS_DB_OPERATION = "db.operation";
export const SEMATTRS_DB_STATEMENT = "db.statement";
export const SEMATTRS_DB_NAME = "db.name";

// Semantic conventions for network attributes
export const SEMATTRS_NET_PEER_NAME = "net.peer.name";
export const SEMATTRS_NET_PEER_PORT = "net.peer.port";

const ATTR_DB_TRANSACTION = "db.transaction";
const ATTR_DB_BATCH_SIZE = "db.operation.batch.size";

type QueryCallback = (error: unknown, result: unknown) => void;

type QueryFunction = (...args: any[]) => any;

interface DrizzleClientLike {
  query?: QueryFunction;
  execute?: QueryFunction;
  [INSTRUMENTED_FLAG]?: true;
  [key: string]: any; // Allow other properties
}

/**
 * Configuration options for Drizzle instrumentation.
 */
export interface InstrumentDrizzleConfig {
  /**
   * Custom tracer name. Defaults to "\@api-blitz/otel-drizzle".
   */
  tracerName?: string;

  /**
   * Database system identifier (e.g., "postgresql", "mysql", "sqlite").
   * Defaults to "postgresql".
   */
  dbSystem?: string;

  /**
   * Database name to include in spans.
   */
  dbName?: string;

  /**
   * Whether to capture full SQL query text in spans.
   * Defaults to true.
   */
  captureQueryText?: boolean;

  /**
   * Maximum length for captured query text. Queries longer than this
   * will be truncated. Defaults to 1000 characters.
   */
  maxQueryTextLength?: number;

  /**
   * Remote hostname or IP address of the database server.
   * Example: "db.example.com" or "192.168.1.100"
   */
  peerName?: string;

  /**
   * Remote port number of the database server.
   * Example: 5432 for PostgreSQL, 3306 for MySQL
   */
  peerPort?: number;
}

interface SpanSettings {
  tracer: Tracer;
  dbSystem: string;
  dbName?: string;
  captureQueryText: boolean;
  maxQueryTextLength: number;
  peerName?: string;
  peerPort?: number;
}

function resolveSettings(config?: InstrumentDrizzleConfig): SpanSettings {
  const {
    tracerName = DEFAULT_TRACER_NAME,
    dbSystem = DEFAULT_DB_SYSTEM,
    dbName,
    captureQueryText = true,
    maxQueryTextLength = 1000,
    peerName,
    peerPort,
  } = config ?? {};

  return {
    tracer: trace.getTracer(tracerName),
    dbSystem,
    dbName,
    captureQueryText,
    maxQueryTextLength,
    peerName,
    peerPort,
  };
}

/**
 * Extracts SQL query text from various query argument formats.
 */
function extractQueryText(queryArg: unknown): string | undefined {
  if (typeof queryArg === "string") {
    return queryArg;
  }
  if (queryArg && typeof queryArg === "object") {
    const query = queryArg as { sql?: unknown; _sql?: unknown };
    // Generic SQL object format (used by Drizzle, LibSQL, MySQL, and others)
    if (typeof query.sql === "string") {
      // drizzle-orm >= 1.0 keeps tagged-template chunks in `_sql` and leaves `sql` empty
      if (query.sql.length === 0 && Array.isArray(query._sql)) {
        return query._sql.join(" ");
      }
      return query.sql;
    }
    // PostgreSQL-style query object
    if (typeof (queryArg as { text?: unknown }).text === "string") {
      return (queryArg as { text: string }).text;
    }
    // Legacy prepared query shape
    if (
      typeof (queryArg as { queryString?: unknown }).queryString === "string"
    ) {
      return (queryArg as { queryString: string }).queryString;
    }
  }
  return undefined;
}

/**
 * Sanitizes and truncates query text for safe inclusion in spans.
 */
function sanitizeQueryText(queryText: string, maxLength: number): string {
  if (queryText.length <= maxLength) {
    return queryText;
  }
  // A plain `substring` is a view that keeps the whole statement (e.g. a large bulk insert)
  // alive while the span waits to be exported. Prefixing and slicing forces a copy of just
  // the kept characters.
  return `${(" " + queryText.substring(0, maxLength)).slice(1)}...`;
}

/**
 * Joins batch statements for `db.statement`, stopping once the text is past `maxLength`
 * rather than building the whole batch's SQL only to truncate it.
 */
function joinBatchStatements(statements: string[], maxLength: number): string {
  let text = statements[0] ?? "";
  for (let i = 1; i < statements.length && text.length <= maxLength; i++) {
    text += `;\n${statements[i]}`;
  }
  return sanitizeQueryText(text, maxLength);
}

/**
 * Extracts the SQL operation (SELECT, INSERT, etc.) from query text.
 */
function extractOperation(queryText: string): string | undefined {
  const trimmed = queryText.trimStart();
  const match = /^(?<op>\w+)/u.exec(trimmed);
  return match?.groups?.op?.toUpperCase();
}

/**
 * What a query span records about its SQL.
 */
interface QueryDescription {
  operation?: string;
  statement?: string;
}

const BATCH_QUERY: QueryDescription = { operation: "BATCH" };

function describeQuery(
  settings: SpanSettings,
  queryText: string | undefined,
): QueryDescription {
  if (queryText === undefined) {
    return {};
  }
  return {
    operation: extractOperation(queryText),
    statement: settings.captureQueryText
      ? sanitizeQueryText(queryText, settings.maxQueryTextLength)
      : undefined,
  };
}

/**
 * Starts a CLIENT span describing a single database operation.
 */
function startQuerySpan(
  settings: SpanSettings,
  { operation, statement }: QueryDescription,
  options: { transaction?: boolean } = {},
): Span {
  const spanName = operation
    ? `drizzle.${operation.toLowerCase()}`
    : "drizzle.query";

  const attributes: Attributes = { [SEMATTRS_DB_SYSTEM]: settings.dbSystem };

  if (options.transaction) {
    attributes[ATTR_DB_TRANSACTION] = true;
  }

  if (operation) {
    attributes[SEMATTRS_DB_OPERATION] = operation;
  }

  if (settings.dbName) {
    attributes[SEMATTRS_DB_NAME] = settings.dbName;
  }

  if (statement !== undefined) {
    attributes[SEMATTRS_DB_STATEMENT] = statement;
  }

  if (settings.peerName) {
    attributes[SEMATTRS_NET_PEER_NAME] = settings.peerName;
  }

  if (settings.peerPort) {
    attributes[SEMATTRS_NET_PEER_PORT] = settings.peerPort;
  }

  return settings.tracer.startSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes,
  });
}

/**
 * Finalizes a span with status, timing, and optional error.
 */
function finalizeSpan(span: Span, error?: unknown): void {
  if (error) {
    if (error instanceof Error) {
      span.recordException(error);
    } else {
      span.recordException(new Error(String(error)));
    }
    span.setStatus({ code: SpanStatusCode.ERROR });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Runs `fn` inside `span` and always returns a promise.
 */
function runAsPromise(span: Span, fn: () => unknown): Promise<unknown> {
  return context.with(trace.setSpan(context.active(), span), () => {
    try {
      return Promise.resolve(fn()).then(
        (value) => {
          finalizeSpan(span);
          return value;
        },
        (error) => {
          finalizeSpan(span, error);
          throw error;
        },
      );
    } catch (error) {
      finalizeSpan(span, error);
      throw error;
    }
  });
}

/**
 * Runs `fn` inside `spanContext` and ends `span` once the result settles. Synchronous
 * results are returned untouched so sync drivers (better-sqlite3, sql.js, bun:sqlite, ...)
 * keep their sync API.
 */
function runPreservingResult<T>(
  span: Span,
  spanContext: Context,
  fn: () => T,
): T {
  let result: T;
  try {
    result = context.with(spanContext, fn);
  } catch (error) {
    finalizeSpan(span, error);
    throw error;
  }

  if (isThenable(result)) {
    return result.then(
      (value) => {
        finalizeSpan(span);
        return value;
      },
      (error) => {
        finalizeSpan(span, error);
        throw error;
      },
    ) as T;
  }

  finalizeSpan(span);
  return result;
}

function isObjectLike(value: unknown): value is Record<PropertyKey, any> {
  return (
    value !== null && (typeof value === "object" || typeof value === "function")
  );
}

function isWrapped(fn: unknown): boolean {
  return typeof fn === "function" && WRAPPED_MARK in fn;
}

function setHidden(target: object, key: PropertyKey, value: unknown): void {
  // Updating a marker we already defined keeps it non-enumerable, and a plain store is far
  // cheaper than `Object.defineProperty` on paths that run for every transaction.
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    try {
      (target as Record<PropertyKey, unknown>)[key] = value;
      return;
    } catch {
      // Read-only: fall through.
    }
  }
  try {
    Object.defineProperty(target, key, {
      value,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    // Frozen / non-extensible object: skip the marker.
  }
}

/**
 * Replaces `target[name]` with `wrapper`. Returns false when the property can't be written.
 */
function patchMethod(
  target: Record<PropertyKey, any>,
  name: string,
  original: QueryFunction,
  wrapper: QueryFunction,
): boolean {
  // Plain store: wrappers are created for every prepared query, and symbol keys stay out of
  // `Object.keys` / JSON anyway.
  (wrapper as Record<PropertyKey, any>)[WRAPPED_MARK] = original;
  try {
    target[name] = wrapper;
  } catch {
    return false;
  }
  return target[name] === wrapper;
}

/**
 * drizzle-orm >= 1.0 ships Effect-based sessions (`drizzle-orm/effect-*`) whose queries
 * return lazy `Effect` values rather than promises. Those are traced through Effect's own
 * OpenTelemetry integration, so we leave them alone.
 */
function isEffectSession(session: unknown): boolean {
  let ctor: unknown = isObjectLike(session) ? session.constructor : undefined;
  while (isObjectLike(ctor)) {
    const kind = ctor[DRIZZLE_ENTITY_KIND];
    if (typeof kind === "string" && kind.includes("Effect")) {
      return true;
    }
    ctor = Object.getPrototypeOf(ctor);
  }
  return false;
}

function isInTransaction(session: unknown, activeContext: Context): boolean {
  if (activeContext.getValue(TRANSACTION_CONTEXT_KEY) === true) {
    return true;
  }
  if (!isObjectLike(session)) {
    return false;
  }
  return (
    session[TRANSACTION_SESSION_FLAG] === true ||
    (session[TRANSACTION_DEPTH] ?? 0) > 0
  );
}

function hasPrepareMethod(value: unknown): value is Record<PropertyKey, any> {
  return (
    isObjectLike(value) &&
    PREPARE_METHODS.some((method) => typeof value[method] === "function")
  );
}

/**
 * Returns the session a drizzle database / transaction / session object prepares queries on.
 */
function findSession(target: unknown): Record<PropertyKey, any> | undefined {
  if (!isObjectLike(target)) {
    return undefined;
  }
  return [target.session, target._?.session, target].find(hasPrepareMethod);
}

function isSessionInstrumented(session: Record<PropertyKey, any>): boolean {
  return PREPARE_METHODS.some((method) => isWrapped(session[method]));
}

/**
 * Whether a call on a prepared query should pass through without its own span.
 */
function isDelegatedCall(
  prepared: Record<PropertyKey, any>,
  method: string,
  activeContext: Context,
): boolean {
  // Called from inside another instrumented method on the same prepared query
  // (e.g. libsql `all()` -> `values()`)
  if (
    busyPrepared === prepared ||
    activeContext.getValue(ACTIVE_QUERY_CONTEXT_KEY) === prepared
  ) {
    return true;
  }
  // SQLite prepared queries implement `execute()` as `this[this.executeMethod]()`, lazily
  // for sync drivers. The delegate (`all` / `get` / `run` / `values`) owns the span.
  const { executeMethod } = prepared;
  return (
    method === "execute" &&
    typeof executeMethod === "string" &&
    executeMethod !== "execute" &&
    typeof prepared[executeMethod] === "function"
  );
}

/**
 * Wraps the methods that run a prepared query so each execution produces one span.
 */
function instrumentPreparedQuery(
  prepared: unknown,
  session: unknown,
  queryText: string | undefined,
  settings: SpanSettings,
): void {
  if (!isObjectLike(prepared)) {
    return;
  }

  // Described on first execution, then reused: a prepared query can run many times.
  let query: QueryDescription | undefined;
  for (const method of PREPARED_QUERY_METHODS) {
    const original = prepared[method];
    if (typeof original !== "function" || isWrapped(original)) {
      continue;
    }

    patchMethod(
      prepared,
      method,
      original,
      function (this: any, ...args: any[]) {
        const self: Record<PropertyKey, any> = isObjectLike(this)
          ? this
          : prepared;
        const activeContext = context.active();

        if (isDelegatedCall(self, method, activeContext)) {
          return original.apply(this, args);
        }

        query ??= describeQuery(settings, queryText);
        const span = startQuerySpan(settings, query, {
          transaction: isInTransaction(session, activeContext),
        });
        const spanContext = trace
          .setSpan(activeContext, span)
          .setValue(ACTIVE_QUERY_CONTEXT_KEY, self);

        return runPreservingResult(span, spanContext, () => {
          const previous = busyPrepared;
          busyPrepared = self;
          try {
            return original.apply(this, args);
          } finally {
            busyPrepared = previous;
          }
        });
      },
    );
  }
}

/**
 * Wraps `session.prepareQuery` (and friends) so the prepared queries they return are traced.
 */
function wrapPrepareMethod(
  session: Record<PropertyKey, any>,
  method: (typeof PREPARE_METHODS)[number],
  settings: SpanSettings,
): boolean {
  const original = session[method];
  if (typeof original !== "function") {
    return false;
  }
  if (isWrapped(original)) {
    return true;
  }

  return patchMethod(
    session,
    method,
    original,
    function (this: any, ...args: any[]) {
      // Prepare is synchronous, so a nested call (`prepareOneTimeQuery` -> `prepareQuery`,
      // same query) always finishes inside the outermost wrapper, which owns the query.
      if (preparing) {
        return original.apply(this, args);
      }
      const owner = isObjectLike(this) ? this : session;
      const queryText = extractQueryText(args[0]);

      let prepared: unknown;
      preparing = true;
      try {
        prepared = original.apply(this, args);
      } catch (error) {
        // Some drivers compile the statement up front (better-sqlite3 rejects unknown
        // columns here), so the query fails before it ever executes.
        finalizeSpan(
          startQuerySpan(settings, describeQuery(settings, queryText), {
            transaction: isInTransaction(owner, context.active()),
          }),
          error,
        );
        throw error;
      } finally {
        preparing = false;
      }

      if (queryText !== undefined) {
        batchStatements?.push(queryText);
      }

      instrumentPreparedQuery(prepared, owner, queryText, settings);
      return prepared;
    },
  );
}

/**
 * Wraps a direct `session.query(sql, params)` method.
 */
function wrapSessionQuery(
  session: Record<PropertyKey, any>,
  settings: SpanSettings,
): boolean {
  const original = session.query;
  if (typeof original !== "function") {
    return false;
  }
  if (isWrapped(original)) {
    return true;
  }

  return patchMethod(
    session,
    "query",
    original,
    function (this: any, ...args: any[]) {
      const activeContext = context.active();
      // Already inside an instrumented prepared query
      if (activeContext.getValue(ACTIVE_QUERY_CONTEXT_KEY) !== undefined) {
        return original.apply(this, args);
      }

      const query = describeQuery(settings, extractQueryText(args[0]));
      const span = startQuerySpan(settings, query, {
        transaction: isInTransaction(this, activeContext),
      });
      return runAsPromise(span, () => original.apply(this, args));
    },
  );
}

/**
 * Wraps `session.batch(queries)` (LibSQL, D1, Neon HTTP, SQLite proxy, ...) in a single
 * `drizzle.batch` span. Batched queries never call `execute()` on their prepared queries.
 */
function wrapBatchMethod(
  session: Record<PropertyKey, any>,
  settings: SpanSettings,
): boolean {
  const original = session.batch;
  if (typeof original !== "function") {
    return false;
  }
  if (isWrapped(original)) {
    return true;
  }

  return patchMethod(
    session,
    "batch",
    original,
    function (this: any, ...args: any[]) {
      const owner = isObjectLike(this) ? this : session;
      const activeContext = context.active();
      const span = startQuerySpan(settings, BATCH_QUERY, {
        transaction: isInTransaction(owner, activeContext),
      });
      if (Array.isArray(args[0])) {
        span.setAttribute(ATTR_DB_BATCH_SIZE, args[0].length);
      }

      return runPreservingResult(
        span,
        trace.setSpan(activeContext, span),
        () => {
          if (!settings.captureQueryText) {
            return original.apply(this, args);
          }
          const previous = batchStatements;
          const statements: string[] = [];
          batchStatements = statements;
          try {
            return original.apply(this, args);
          } finally {
            batchStatements = previous;
            if (statements.length > 0) {
              span.setAttribute(
                SEMATTRS_DB_STATEMENT,
                joinBatchStatements(statements, settings.maxQueryTextLength),
              );
            }
          }
        },
      );
    },
  );
}

/**
 * Wraps an `execute` method that runs SQL directly and always resolves to a promise.
 */
function wrapExecuteMethod(
  target: Record<PropertyKey, any>,
  settings: SpanSettings,
  options: { transaction?: boolean } = {},
): boolean {
  const original = target.execute;
  if (typeof original !== "function") {
    return false;
  }
  if (isWrapped(original)) {
    return true;
  }

  return patchMethod(
    target,
    "execute",
    original,
    function (this: any, ...args: any[]) {
      const query = describeQuery(settings, extractQueryText(args[0]));
      const span = startQuerySpan(settings, query, options);
      return runAsPromise(span, () => original.apply(this, args));
    },
  );
}

function adjustTransactionDepth(session: unknown, delta: number): void {
  if (isObjectLike(session)) {
    setHidden(
      session,
      TRANSACTION_DEPTH,
      Math.max(0, (session[TRANSACTION_DEPTH] ?? 0) + delta),
    );
  }
}

/**
 * Instruments the transaction object handed to a `transaction()` callback.
 * Returns the session its queries run through.
 */
function instrumentTransaction(tx: unknown, settings: SpanSettings): unknown {
  if (!isObjectLike(tx)) {
    return undefined;
  }

  const txSession = findSession(tx);

  if (txSession) {
    // Most drivers create a dedicated session per transaction; drivers holding a single
    // connection (node-postgres Client, better-sqlite3, ...) reuse the parent session.
    if (!isSessionInstrumented(txSession)) {
      setHidden(txSession, TRANSACTION_SESSION_FLAG, true);
      instrumentSession(txSession, settings);
    }
  } else {
    // Transaction objects that only expose `execute`
    wrapExecuteMethod(tx, settings, { transaction: true });
  }

  // Nested transactions (savepoints)
  wrapTransactionMethod(tx, settings);

  return txSession ?? tx;
}

/**
 * Wraps `target.transaction(callback, config)` so queries inside the callback are traced and
 * flagged with `db.transaction`. The callback's return value is passed through untouched,
 * which keeps sync drivers (better-sqlite3 requires a sync callback) working.
 */
function wrapTransactionMethod(
  target: Record<PropertyKey, any>,
  settings: SpanSettings,
): boolean {
  const original = target.transaction;
  if (typeof original !== "function") {
    return false;
  }
  if (isWrapped(original)) {
    return true;
  }

  return patchMethod(
    target,
    "transaction",
    original,
    function (this: any, transactionCallback: unknown, ...restArgs: any[]) {
      if (typeof transactionCallback !== "function") {
        return original.apply(this, [transactionCallback, ...restArgs]);
      }

      const wrappedCallback = function (
        this: unknown,
        tx: unknown,
        ...callbackArgs: unknown[]
      ) {
        const txSession = instrumentTransaction(tx, settings);

        adjustTransactionDepth(txSession, 1);
        let result: unknown;
        try {
          result = transactionCallback.apply(this, [tx, ...callbackArgs]);
        } catch (error) {
          adjustTransactionDepth(txSession, -1);
          throw error;
        }

        if (isThenable(result)) {
          const leave = () => adjustTransactionDepth(txSession, -1);
          result.then(leave, leave);
        } else {
          adjustTransactionDepth(txSession, -1);
        }
        return result;
      };

      // Everything the driver runs for this transaction (`begin`, `commit`, `rollback`,
      // savepoints) belongs to it. The context covers async drivers when a context manager
      // is registered; the depth counter covers queries started synchronously (sql.js).
      const txContext = context
        .active()
        .setValue(TRANSACTION_CONTEXT_KEY, true);
      const ownSession = findSession(this);
      adjustTransactionDepth(ownSession, 1);
      try {
        return context.with(txContext, () =>
          original.apply(this, [wrappedCallback, ...restArgs]),
        );
      } finally {
        adjustTransactionDepth(ownSession, -1);
      }
    },
  );
}

/**
 * Instruments a drizzle session. Returns true when the session is (now) instrumented.
 */
function instrumentSession(
  session: Record<PropertyKey, any>,
  settings: SpanSettings,
): boolean {
  let instrumented = false;

  for (const method of PREPARE_METHODS) {
    instrumented = wrapPrepareMethod(session, method, settings) || instrumented;
  }
  if (instrumented) {
    setHidden(session, INSTRUMENTED_FLAG, true);
  }

  instrumented = wrapSessionQuery(session, settings) || instrumented;
  instrumented = wrapTransactionMethod(session, settings) || instrumented;
  instrumented = wrapBatchMethod(session, settings) || instrumented;

  return instrumented;
}

/**
 * Instruments a database connection pool/client with OpenTelemetry tracing.
 *
 * This function wraps the connection's `query` and `execute` methods to create spans for each database
 * operation.
 * The instrumentation is idempotent - calling it multiple times on the same connection will only
 * instrument it once.
 *
 * @typeParam TClient - The type of the database connection pool or client
 * @param client - The database connection pool or client to instrument
 * @param config - Optional configuration for instrumentation behavior
 * @returns The instrumented pool/client (same instance, modified in place)
 *
 * @example
 * ```typescript
 * // PostgreSQL with node-postgres
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { Pool } from 'pg';
 * import { instrumentDrizzle } from '@api-blitz/otel-drizzle';
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const instrumentedPool = instrumentDrizzle(pool, {
 *   dbSystem: 'postgresql',
 *   dbName: 'myapp',
 *   peerName: 'db.example.com',
 *   peerPort: 5432,
 * });
 * const db = drizzle({ client: instrumentedPool });
 * ```
 *
 * @example
 * ```typescript
 * // MySQL with mysql2
 * import { drizzle } from 'drizzle-orm/mysql2';
 * import mysql from 'mysql2/promise';
 * import { instrumentDrizzle } from '@api-blitz/otel-drizzle';
 *
 * const connection = await mysql.createConnection({
 *   host: 'localhost',
 *   user: 'root',
 *   database: 'mydb',
 * });
 * const instrumentedConnection = instrumentDrizzle(connection, { dbSystem: 'mysql' });
 * const db = drizzle({ client: instrumentedConnection });
 * ```
 *
 * @example
 * ```typescript
 * // LibSQL/Turso
 * import { drizzle } from 'drizzle-orm/libsql';
 * import { createClient } from '@libsql/client';
 * import { instrumentDrizzle } from '@api-blitz/otel-drizzle';
 *
 * const client = createClient({
 *   url: process.env.DATABASE_URL!,
 *   authToken: process.env.DATABASE_AUTH_TOKEN,
 * });
 * const instrumentedClient = instrumentDrizzle(client, { dbSystem: 'sqlite' });
 * const db = drizzle({ client: instrumentedClient });
 * ```
 */
export function instrumentDrizzle<TClient extends DrizzleClientLike>(
  client: TClient,
  config?: InstrumentDrizzleConfig,
): TClient {
  if (!client) {
    return client;
  }

  // Check if client has query or execute method
  const hasQuery = typeof client.query === "function";
  const hasExecute = typeof client.execute === "function";

  if (!hasQuery && !hasExecute) {
    return client;
  }

  if (client[INSTRUMENTED_FLAG]) {
    return client;
  }

  const settings = resolveSettings(config);

  // Store the original method (query or execute)
  const originalMethod = hasQuery ? client.query : client.execute;

  if (!originalMethod) {
    return client;
  }

  const instrumentedMethod: QueryFunction = function instrumented(
    this: any,
    ...incomingArgs: any[]
  ) {
    const args = [...incomingArgs];
    let callback: QueryCallback | undefined;

    // Detect callback pattern
    if (typeof args[args.length - 1] === "function") {
      callback = args.pop() as QueryCallback;
    }

    const span = startQuerySpan(
      settings,
      describeQuery(settings, extractQueryText(args[0])),
    );

    // Callback-based pattern
    if (callback) {
      const userCallback = callback;
      return context.with(trace.setSpan(context.active(), span), () => {
        const wrappedCallback: QueryCallback = (err, result) => {
          finalizeSpan(span, err);
          userCallback(err, result);
        };

        try {
          return originalMethod.apply(this, [...args, wrappedCallback]);
        } catch (error) {
          finalizeSpan(span, error);
          throw error;
        }
      });
    }

    // Promise-based pattern
    return runAsPromise(span, () => originalMethod.apply(this, args));
  };

  client[INSTRUMENTED_FLAG] = true;

  // Replace the original method with the instrumented one
  if (hasQuery) {
    client.query = instrumentedMethod;
  } else {
    client.execute = instrumentedMethod;
  }

  return client;
}

/**
 * Interface for Drizzle database instances with minimal type requirements.
 */
interface DrizzleDbLike {
  $client?: DrizzleClientLike | any; // Allow any client type
  execute?: QueryFunction; // Direct execute method on db
  transaction?: QueryFunction; // Transaction method on db
  _?: {
    session?: {
      execute?: QueryFunction;
      [INSTRUMENTED_FLAG]?: true;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [INSTRUMENTED_FLAG]?: true;
  [key: string]: any; // Allow other properties
}

/**
 * Instruments a Drizzle database instance with OpenTelemetry tracing.
 *
 * This function instruments the database at the session level, automatically tracing all database
 * operations including query builders, relational queries, direct SQL execution, batches and
 * transactions (including nested transactions / savepoints).
 *
 * Works with drizzle-orm 0.28 and later, including the 1.0 release line, across PostgreSQL,
 * MySQL, SingleStore and SQLite drivers. Sync SQLite drivers (better-sqlite3, bun:sqlite,
 * sql.js, ...) keep their synchronous API. Read replicas created with `withReplicas()` are
 * instrumented too.
 *
 * The instrumentation is idempotent - calling it multiple times on the same
 * database will only instrument it once.
 *
 * @typeParam TDb - The type of the Drizzle database instance
 * @param db - The Drizzle database instance to instrument
 * @param config - Optional configuration for instrumentation behavior
 * @returns The instrumented database instance (same instance, modified in place)
 *
 * @example
 * ```typescript
 * // PostgreSQL with postgres.js
 * import { drizzle } from 'drizzle-orm/postgres-js';
 * import postgres from 'postgres';
 * import { instrumentDrizzleClient } from '@api-blitz/otel-drizzle';
 *
 * // Using connection string
 * const db = drizzle(process.env.DATABASE_URL!);
 * instrumentDrizzleClient(db, { dbSystem: 'postgresql' });
 *
 * // Or with a client instance
 * const queryClient = postgres(process.env.DATABASE_URL!);
 * const db = drizzle({ client: queryClient });
 * instrumentDrizzleClient(db, { dbSystem: 'postgresql' });
 * ```
 *
 * @example
 * ```typescript
 * // PostgreSQL with node-postgres (pg)
 * import { drizzle } from 'drizzle-orm/node-postgres';
 * import { Pool } from 'pg';
 * import { instrumentDrizzleClient } from '@api-blitz/otel-drizzle';
 *
 * // Using connection string
 * const db = drizzle(process.env.DATABASE_URL!);
 * instrumentDrizzleClient(db, { dbSystem: 'postgresql' });
 *
 * // Or with a pool
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const db = drizzle({ client: pool });
 * instrumentDrizzleClient(db, {
 *   dbSystem: 'postgresql',
 *   dbName: 'myapp',
 *   peerName: 'db.example.com',
 *   peerPort: 5432,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // MySQL with mysql2
 * import { drizzle } from 'drizzle-orm/mysql2';
 * import mysql from 'mysql2/promise';
 * import { instrumentDrizzleClient } from '@api-blitz/otel-drizzle';
 *
 * // Using connection string
 * const db = drizzle(process.env.DATABASE_URL!);
 * instrumentDrizzleClient(db, { dbSystem: 'mysql' });
 *
 * // Or with a connection
 * const connection = await mysql.createConnection({
 *   host: 'localhost',
 *   user: 'root',
 *   database: 'mydb',
 * });
 * const db = drizzle({ client: connection });
 * instrumentDrizzleClient(db, {
 *   dbSystem: 'mysql',
 *   dbName: 'mydb',
 *   peerName: 'localhost',
 *   peerPort: 3306,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // SQLite with better-sqlite3
 * import { drizzle } from 'drizzle-orm/better-sqlite3';
 * import Database from 'better-sqlite3';
 * import { instrumentDrizzleClient } from '@api-blitz/otel-drizzle';
 *
 * // Using file path
 * const db = drizzle('sqlite.db');
 * instrumentDrizzleClient(db, { dbSystem: 'sqlite' });
 *
 * // Or with a Database instance
 * const sqlite = new Database('sqlite.db');
 * const db = drizzle({ client: sqlite });
 * instrumentDrizzleClient(db, { dbSystem: 'sqlite' });
 * ```
 *
 * @example
 * ```typescript
 * // SQLite with LibSQL/Turso
 * import { drizzle } from 'drizzle-orm/libsql';
 * import { createClient } from '@libsql/client';
 * import { instrumentDrizzleClient } from '@api-blitz/otel-drizzle';
 *
 * // Using connection config
 * const db = drizzle({
 *   connection: {
 *     url: process.env.DATABASE_URL!,
 *     authToken: process.env.DATABASE_AUTH_TOKEN,
 *   }
 * });
 * instrumentDrizzleClient(db, { dbSystem: 'sqlite' });
 *
 * // Or with a client instance
 * const client = createClient({
 *   url: process.env.DATABASE_URL!,
 *   authToken: process.env.DATABASE_AUTH_TOKEN,
 * });
 * const db = drizzle({ client });
 * instrumentDrizzleClient(db, { dbSystem: 'sqlite' });
 * ```
 */
export function instrumentDrizzleClient<TDb extends DrizzleDbLike>(
  db: TDb,
  config?: InstrumentDrizzleConfig,
): TDb {
  if (!db) {
    return db;
  }

  // Check if already instrumented
  if (db[INSTRUMENTED_FLAG]) {
    return db;
  }

  const session = (db as DrizzleDbLike).session ?? db._?.session;
  if (isEffectSession(session)) {
    return db;
  }

  const settings = resolveSettings(config);
  let instrumented = false;

  // First priority: Instrument the session directly
  // This is where all queries actually go through
  if (isObjectLike((db as DrizzleDbLike).session)) {
    instrumented = instrumentSession((db as DrizzleDbLike).session, settings);
  }

  // Read replicas created with `withReplicas()` have their own sessions
  if (Array.isArray(db.$replicas)) {
    for (const replica of db.$replicas) {
      instrumentDrizzleClient(replica, config);
    }
  }
  if (isObjectLike(db.$primary) && db.$primary !== db) {
    instrumentDrizzleClient(db.$primary, config);
  }

  if (db.$client && !instrumented) {
    const client = db.$client;
    // Check if client has query or execute function
    if (
      typeof client.query === "function" ||
      typeof client.execute === "function"
    ) {
      instrumentDrizzle(client, config);
      instrumented = true;
    }
  }

  // Third priority: Try to instrument via session.execute as fallback
  if (
    db._ &&
    db._.session &&
    typeof db._.session.execute === "function" &&
    !instrumented
  ) {
    const fallbackSession = db._.session;

    // Check if already instrumented
    if (fallbackSession[INSTRUMENTED_FLAG]) {
      return db;
    }

    fallbackSession[INSTRUMENTED_FLAG] = true;
    instrumented = wrapExecuteMethod(fallbackSession, settings);
  }

  // Mark the db as instrumented if we instrumented anything
  if (instrumented) {
    db[INSTRUMENTED_FLAG] = true;
  }

  return db;
}
