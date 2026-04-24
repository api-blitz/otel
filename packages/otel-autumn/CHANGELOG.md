# @api-blitz/otel-autumn

## 1.1.0

### Minor Changes

- [#4](https://github.com/api-blitz/otel/pull/4) [`3f2dd12`](https://github.com/api-blitz/otel/commit/3f2dd12edc97e22a59b64847886f090a13ea79ea) Thanks [@ibadus](https://github.com/ibadus)! - Add `autumn-js` pre-1.0 compatibility.

  - Widen `autumn-js` peer range to `>=0.0.70 <2.0.0`.
  - Wrap pre-1.0 flat top-level methods (`attach`, `cancel`, `setupPayment`, `usage`) alongside the existing 1.x sub-resource coverage; methods missing from the installed SDK are skipped silently.
  - Unwrap the pre-1.0 `Result<T, E>` response envelope so response-side span attributes populate the same on both versions.
  - Map `product_id`/`product_ids` to `autumn.plan_id`/`autumn.plan_ids` for dashboard consistency across versions.
