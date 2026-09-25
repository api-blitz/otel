---
"@api-blitz/otel-drizzle": patch
---

Cut the per-query overhead of the instrumentation. Spans and attributes are unchanged.

- Stop calling `Object.defineProperty` on every query: the "busy" marker used to dedupe internal delegation and the `db.batch()` statement collector are now module-level variables instead of hidden properties on drizzle objects, wrapper marks are plain symbol stores, and transaction markers are only defined once per object.
- Replace the two module-level `WeakSet`s touched on every prepared query with a synchronous re-entrancy flag (`prepareOneTimeQuery` → `prepareQuery`).
- Statements reused with `.prepare()` work out their operation and truncated `db.statement` once, not on every execution.
- Copy truncated `db.statement` text instead of keeping a view into the original string, so queued spans no longer hold the full SQL of large statements (e.g. bulk inserts) in memory until export.
- `db.batch()` no longer collects statements when `captureQueryText` is `false`, and stops joining them once `maxQueryTextLength` is reached.
