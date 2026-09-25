---
"@api-blitz/otel-drizzle": minor
---

Support the latest `drizzle-orm` releases (0.45 and the 1.0 line) while keeping 0.28+ working.

- Widen the `drizzle-orm` peer range to `>=0.28.0 || >=1.0.0-0` so 1.0 betas / release candidates install without peer warnings.
- Trace SQLite prepared queries through `run` / `all` / `get` / `values`, which previously produced no spans. Sync drivers (better-sqlite3, bun:sqlite, sql.js) keep their synchronous API.
- Fix sync `db.transaction()` callbacks crashing on better-sqlite3 ("Transaction function cannot return a promise").
- Remove the duplicate `drizzle.query` span emitted for `tx.execute()` inside transactions, and trace nested transactions (savepoints) on drivers that open a new session for them.
- Record queries that fail while being prepared (e.g. unknown columns on better-sqlite3) as error spans.
- Trace `db.batch([...])` as a single `drizzle.batch` span, and instrument `withReplicas()` replicas automatically.
- Read tagged-template query text used by drizzle-orm 1.0, and skip the 1.0 Effect drivers.
