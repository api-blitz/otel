---
"@api-blitz/otel-autumn": patch
---

Reduce instrumentation work, especially for unsampled spans and large batches.

- Skip request/response annotation when the span isn't recording (no SDK registered, or sampled out).
- `batchTrack` finds the shared customer / entity / feature / event name in a single pass with early exit instead of building a `Set` per attribute, so annotating large batches stays cheap.
- Pass `billing.system`, `billing.operation`, `autumn.resource` and `autumn.target` to `startSpan`, so attribute-based samplers can use them. The recorded attributes are unchanged.
