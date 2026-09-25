# @api-blitz/otel-drizzle

## 1.1.1

### Patch Changes

- [#9](https://github.com/api-blitz/otel/pull/9) [`4e85a41`](https://github.com/api-blitz/otel/commit/4e85a41e6914a2147f560b1fb7a28d93a2799fbd) Thanks [@ibadus](https://github.com/ibadus)! - Cut the per-query overhead of the instrumentation. Spans and attributes are unchanged.

  - Stop calling `Object.defineProperty` on every query: the "busy" marker used to dedupe internal delegation and the `db.batch()` statement collector are now module-level variables instead of hidden properties on drizzle objects, wrapper marks are plain symbol stores, and transaction markers are only defined once per object.
  - Replace the two module-level `WeakSet`s touched on every prepared query with a synchronous re-entrancy flag (`prepareOneTimeQuery` → `prepareQuery`).
  - Statements reused with `.prepare()` work out their operation and truncated `db.statement` once, not on every execution.
  - Copy truncated `db.statement` text instead of keeping a view into the original string, so queued spans no longer hold the full SQL of large statements (e.g. bulk inserts) in memory until export.
  - `db.batch()` no longer collects statements when `captureQueryText` is `false`, and stops joining them once `maxQueryTextLength` is reached.

## 1.1.0

### Minor Changes

- [#6](https://github.com/api-blitz/otel/pull/6) [`da4b7c4`](https://github.com/api-blitz/otel/commit/da4b7c4fd029dbfbdd8710b3e67be7c57c490f2f) Thanks [@ibadus](https://github.com/ibadus)! - Support the latest `drizzle-orm` releases (0.45 and the 1.0 line) while keeping 0.28+ working.

  - Widen the `drizzle-orm` peer range to `>=0.28.0 || >=1.0.0-0` so 1.0 betas / release candidates install without peer warnings.
  - Trace SQLite prepared queries through `run` / `all` / `get` / `values`, which previously produced no spans. Sync drivers (better-sqlite3, bun:sqlite, sql.js) keep their synchronous API.
  - Fix sync `db.transaction()` callbacks crashing on better-sqlite3 ("Transaction function cannot return a promise").
  - Remove the duplicate `drizzle.query` span emitted for `tx.execute()` inside transactions, and trace nested transactions (savepoints) on drivers that open a new session for them.
  - Record queries that fail while being prepared (e.g. unknown columns on better-sqlite3) as error spans.
  - Trace `db.batch([...])` as a single `drizzle.batch` span, and instrument `withReplicas()` replicas automatically.
  - Read tagged-template query text used by drizzle-orm 1.0, and skip the 1.0 Effect drivers.
