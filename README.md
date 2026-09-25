# The only Telemetry SDK you’ll ever need for TypeScript observability.

## Vision

Observability should give engineers a clear view of what their systems are doing and not feel like another setup you have to wrestle with.

Our goal is to bring the TypeScript ecosystem the observability tools it’s been missing — built on the OpenTelemetry standard and designed to integrate natively with your favorite stack.

---

## Supported integrations

- [`@api-blitz/otel-autumn`](./packages/otel-autumn/README.md)
- [`@api-blitz/otel-drizzle`](./packages/otel-drizzle/README.md)

---

## Installation

Every package has a peer dependency on `@opentelemetry/api`, so install it alongside:

```bash
pnpm add @api-blitz/otel-drizzle @opentelemetry/api
# or: npm install / yarn add / bun add
```

Then in your code:

```ts
import { instrumentDrizzle } from "@api-blitz/otel-drizzle";
```

Versions follow semver. Pin with `^1.0.0` (caret) to get patch and minor updates automatically.

---

## Examples

Want to see what the traces actually look like before you install? Each package ships a playground that replays a realistic workload through the instrumentation and exports the resulting spans to a local Jaeger UI — no API keys, no database required. See **[EXAMPLES.md](./EXAMPLES.md)**.

---

## Releasing (maintainers)

Releases are cut by CI ([`.github/workflows/release.yml`](./.github/workflows/release.yml)) with [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers). No npm token or PAT is stored anywhere. Per change:

```bash
pnpm changeset                 # pick packages + bump type, write summary
```

Commit the changeset with your PR. Once it lands on `main`, the workflow opens (or updates) a **Version Packages** PR. Merging that PR publishes every package whose version is ahead of npm, with provenance, and creates the GitHub releases and tags.

Each package must have a trusted publisher on npm pointing at this workflow (repo `api-blitz/otel`, workflow `release.yml`, environment `npm`). With npm >= 11.15 (older CLIs get a bare `400` because they don't send the now-required `--allow-publish` permission; pin the version, since `npx npm@11` reuses an older installed 11.x):

```bash
npx npm@11.20.0 trust github @api-blitz/otel-<name> --repo api-blitz/otel --file release.yml --env npm --allow-publish
```

A package can only have one trusted publisher, so `npx npm@11.20.0 trust revoke <pkg> --id=<id>` an existing one (see `npm trust list <pkg>`) before replacing it.

A brand-new package has to exist on npm before a trusted publisher can be attached, so its very first version goes out by hand from a logged-in checkout (`pnpm build && pnpm --filter @api-blitz/otel-<name> publish --access public`). After that, run the `npm trust` command above.

---

## Coming soon

Need support for something? [Open an issue](https://github.com/api-blitz/otel/issues) to request or ship a new integration.

## Credits

Originally forked from [Kubiks](https://github.com/kubiks-inc/otel). Continued under the `@api-blitz/*` scope.

## License

This project is licensed under the MIT License.
