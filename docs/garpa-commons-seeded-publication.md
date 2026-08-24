# GARPA Commons-seeded publication custody

This stage converts the admitted target mission and vendor-parity records into the complete public-claim set without allowing a favorable sentence, omitted residual, stale digest, or unreviewed artifact to replace the governed case record.

```text
qualified Commons-seeded vendor parity
  + deterministic mission, residual, and parity claims
  + exact support coordinates and prohibited generalizations
  + exact upstream digest set and case index
  + rights review for every vendor evidence artifact
  + safety review, audience, and redaction record
  + existing publication package and publication gate
  -> Commons publication-custody gate
  -> existing publication gate
  -> publication_ready | blocked ordinary publication state
```

The complete claim set is generated from the existing mission and parity results. A matched bounded mission produces bounded mission language. A failed or partial mission remains failed or partial. A same-fixture parity match produces exact-version bounded parity language. A miss, missing baseline, evidence-only comparison, scenario mismatch, accounting mismatch, incomparable comparison, or not-attempted state produces an explicit residual rather than parity language.

Every generated claim carries the exact build, scenario, metric, evaluation, and run-receipt coordinates, together with mandatory limitations and prohibited generalizations. Omitted residuals, changed claim text, changed scope, changed support edges, changed dispositions, and stale upstream digests fail closed.

Publication record admission and publication readiness are distinct. A coherent package whose rights review, safety review, redactions, or ordinary support rules block publication may still be admitted as a trustworthy blocked record. Only `publication_ready` may proceed to release-manifest construction, and that state does not itself establish release integrity, current registry status, deployment authority, or unrestricted equivalence.
