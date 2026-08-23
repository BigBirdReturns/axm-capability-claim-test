# GARPA publication and release

GARPA does not publish directly from model-authored prose. Every substantive sentence first becomes a typed publication claim with explicit scope, support edges, limitations, and prohibited generalizations.

## Publication gate

The publication gate refuses a package when:

- a substantive claim lacks positive source, measurement, evaluation, or cost support;
- a mission-evaluation claim omits scenario or metric scope;
- a cost comparison lacks cost-line receipts or a complete aligned accounting boundary;
- vendor-parity language lacks a same-fixture vendor comparison;
- a required redaction removes the evidence supporting a claim;
- upstream build, qualification, or evaluation digests are stale;
- rights or safety review do not permit the selected audience.

A `bounded_match` is compiled into bounded language. It carries explicit prohibitions against operational equivalence and vendor parity.

## Immutable release

A release manifest contains the exact SHA-256 digest and byte length of every included file. The verifier requires:

```text
release.json
README.md
reality-brief.md
public-dossier.md
claims/publication-claims.json
claims/support-graph.json
receipts/publication-gate.json
```

The verifier blocks missing files, hash changes, byte-length changes, unmanifested files, unsafe paths, duplicate paths, and a release whose publication gate did not pass.

A corrected result creates a later release and preserves the earlier release as superseded. The release verifier does not rewrite history.

The synthetic observation fixture can publish only the bounded statement that its controlled observation and simulated-response slice passed the frozen essential metric. It cannot publish physical mitigation, operational equivalence, or vendor parity.
