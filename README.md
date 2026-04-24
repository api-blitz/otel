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

## Releasing (maintainers)

Releases go out by hand from a local checkout. Per change:

```bash
pnpm changeset                 # pick packages + bump type, write summary
```

When ready to ship the accumulated changesets:

```bash
pnpm version-packages          # consumes changesets, bumps versions, updates CHANGELOGs
git commit -am "Version Packages"
pnpm release                   # runs build, then changeset publish
git push --follow-tags
```

`pnpm release` uses the `NPM_TOKEN` in your shell (or `npm login` session) and publishes every package whose local version is ahead of the npm registry.

For the very first publish on a brand-new scope (nothing on the registry yet), skip the Changesets dance and just run:

```bash
pnpm build
pnpm -r publish --access public
```

---

## Coming soon

Need support for something? [Open an issue](https://github.com/api-blitz/otel/issues) to request or ship a new integration.

## Credits

Originally forked from [Kubiks](https://github.com/kubiks-inc/otel). Continued under the `@api-blitz/*` scope.

## License

This project is licensed under the MIT License.
