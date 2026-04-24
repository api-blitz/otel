# otel-drizzle trace playground

Replays representative queries across **every instrumentation surface** that `@api-blitz/otel-drizzle` supports and exports the spans via OTLP/HTTP to a local Jaeger. Use this to visually verify span names, `db.*` attributes, transaction markers, error handling, and long-query truncation.

## Run it

From the repo root:

```bash
docker compose up -d                                  # starts Jaeger on :16686 and :4318
pnpm --filter @api-blitz/otel-drizzle install         # first time only
pnpm --filter @api-blitz/otel-drizzle example
```

Then open <http://localhost:16686>, pick **Service** `otel-drizzle-demo`, and click **Find Traces**.

When finished:

```bash
docker compose down
```

## What you should see

**30 `CLIENT`-kind spans** across 12 distinct SQL operations, including 2 ERROR spans, 3 transaction spans, and 1 truncated-query span. Every span carries `db.system=postgresql`, `db.name=demo`, `net.peer.name=localhost`, `net.peer.port=5432`.

### Phase 1 — `instrumentDrizzle` with `query` (promise-based)

17 spans covering every SQL verb the operation extractor recognizes, plus all three query-object shapes, plus truncation and one error.

| SQL verb | Span name | Input shape |
|---|---|---|
| `SELECT` | `drizzle.select` | string |
| `INSERT` | `drizzle.insert` | string |
| `UPDATE` | `drizzle.update` | string |
| `DELETE` | `drizzle.delete` | string |
| `CREATE` | `drizzle.create` | string |
| `ALTER` | `drizzle.alter` | string |
| `DROP` | `drizzle.drop` | string |
| `TRUNCATE` | `drizzle.truncate` | string |
| `BEGIN` | `drizzle.begin` | string |
| `COMMIT` | `drizzle.commit` | string |
| `SET` | `drizzle.set` | string |
| `WITH` | `drizzle.with` | string |
| `INSERT` | `drizzle.insert` | `{ sql, params }` |
| `UPDATE` | `drizzle.update` | `{ text, values }` |
| `SELECT` | `drizzle.select` | `{ sql, queryChunks }` |
| `SELECT` | `drizzle.select` | long query → `db.statement` truncated to 1000 chars + `...` |
| `SELECT` | `drizzle.select` (ERROR) | `SELECT nonexistent_column FROM users` — promise rejects |

### Phase 2 — `instrumentDrizzle` with callback pattern (2 spans)

- `drizzle.select` (OK) — `SELECT id FROM users /* callback-success */`
- `drizzle.select` (ERROR) — `SELECT nonexistent_column FROM users /* callback-error */`

### Phase 3 — `instrumentDrizzle` with `execute` (2 spans)

- `drizzle.select` — `SELECT * FROM users WHERE id = $1 /* via execute */` (string arg)
- `drizzle.delete` — `DELETE FROM users WHERE id = $1 /* via execute */` (`{ sql, args }` arg)

### Phase 4 — `instrumentDrizzleClient` session: `prepareQuery` + `query` (3 spans)

Exercises the Drizzle query-builder path (`db.select().from()` internally calls `session.prepareQuery(...).execute()`):

- `drizzle.select` — prepared `SELECT * FROM users /* prepared */`
- `drizzle.insert` — prepared `INSERT INTO users (name) VALUES ($1) /* prepared */`
- `drizzle.update` — direct `session.query("UPDATE users SET name = $1 /* direct session */", ["Ada"])`

### Phase 5 — `instrumentDrizzleClient` transaction (3 spans, each with `db.transaction=true`)

Exercises `session.transaction(tx => ...)` where the callback calls `tx.execute(...)`:

- `drizzle.set` — `SET LOCAL role org_role /* in tx */`
- `drizzle.select` — `SELECT set_config('request.org_id', $1, true) /* in tx */`
- `drizzle.insert` — `INSERT INTO org_audit (action) VALUES ($1) /* in tx */`

### Phase 6 — `instrumentDrizzleClient` with `$client` fallback (1 span)

Exercises the fallback path when `db` has a `$client` property but no `session` (drizzle postgres-js pattern):

- `drizzle.select` — `SELECT id FROM users /* via $client */`

### Phase 7 — `instrumentDrizzleClient` with `_.session.execute` fallback (2 spans)

Exercises the last-resort fallback when `db._.session.execute` is the only instrumentable surface:

- `drizzle.insert` — `INSERT INTO users (name) VALUES ($1) /* via _.session */`
- `drizzle.delete` — `DELETE FROM users WHERE id = $1 /* via _.session */`

## Quick Jaeger API checks

```bash
# Expect 12 unique operations
curl -s 'http://localhost:16686/api/services/otel-drizzle-demo/operations' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])"

# Expect 30 total spans, 2 error spans, 3 transaction spans
curl -s 'http://localhost:16686/api/traces?service=otel-drizzle-demo&limit=200' \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
total=err=tx=0
for t in d['data']:
  for s in t['spans']:
    total += 1
    tags={x['key']:x.get('value') for x in s.get('tags',[])}
    if tags.get('error')==True: err += 1
    if tags.get('db.transaction')==True: tx += 1
print(f'{total} spans, {err} errors, {tx} in tx')"
```

## Notes

- Every surface is exercised via **plain-object mocks** (same pattern as the unit tests), so no real Postgres is required.
- The demo runs with `dbSystem=postgresql`, `dbName=demo`, `peerName=localhost`, `peerPort=5432` so you can verify those attributes appear on every span.
- Default `maxQueryTextLength=1000`; the long-query span demonstrates truncation with a trailing `...`.
- OTLP endpoint defaults to `http://localhost:4318`; override with `OTEL_EXPORTER_OTLP_ENDPOINT` if Jaeger runs elsewhere.
