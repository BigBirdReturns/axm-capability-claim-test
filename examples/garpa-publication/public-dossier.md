# GARPA Public Dossier — Synthetic Observation Composition

## Release disposition
- Case: GARPA-PUBLICATION-0001
- Disposition: compose
- Audience: public
- Claim report: claim-report-digest-1
- Mission evaluation: mission-evaluation-digest-1
- Mission state: bounded_match
- Vendor parity evaluation: vendor-parity-digest-1
- Vendor parity state: same_fixture_match

## Admitted claims

### pub-mission-1 · mission_evaluation

Under the frozen bounded scenarios and metrics, GARPA build build-receipt-digest-1 satisfied the evaluated mission slice.

Scope:
- Offering version: Not applicable or unresolved
- Build digest: build-receipt-digest-1
- Scenarios: scenario-passive-observation
- Metrics: m-detection, m-latency-ms
- Environment: Isolated passive bench fixture
- Evaluation period: Not applicable

Support:
- evaluated_by: mission-evaluation-digest-1. Frozen bounded mission evaluation.
- measured_by: run-valid-1. Admitted test-run receipt.

Limitations:
- The result covers passive observation, tracking, operator presentation, logging, and replay only.

Prohibited generalizations:
- Do not claim operational mitigation, regulated active effects, full-mission equivalence, or unrestricted field performance.

### pub-residual-1 · residual

The result applies only to the frozen evaluated boundary and does not establish full-mission or vendor-system equivalence.

Scope:
- Offering version: Not applicable or unresolved
- Build digest: build-receipt-digest-1
- Scenarios: scenario-passive-observation
- Metrics: m-detection, m-latency-ms
- Environment: See governing evaluation
- Evaluation period: Not applicable

Support:
- limited_by: mission-evaluation-digest-1. Residual carried from the bounded mission evaluation.

Limitations:
- None recorded.

Prohibited generalizations:
- Do not omit this residual from a release carrying the mission claim.

### pub-parity-1 · vendor_parity

Against Synthetic Vendor Reference System version reference-1.0.0, GARPA matched detection and operator-presentation latency under the same frozen fixture and measurement method.

Scope:
- Offering version: reference-1.0.0
- Build digest: build-receipt-digest-1
- Scenarios: scenario-passive-observation
- Metrics: m-detection, m-latency-ms
- Environment: See governing evaluation
- Evaluation period: Not applicable

Support:
- evaluated_by: vendor-parity-digest-1. Exact-version same-fixture parity evaluation.

Limitations:
- The vendor reference result is a synthetic regression fixture and the comparison is confined to the bounded metric set.

Prohibited generalizations:
- Do not claim unrestricted full-system, field, operational, lifecycle, or real-vendor equivalence.

## Failure and contradiction history
Disclosed failures:
- run-aborted-1

Disclosed contradictions:
- None recorded.

## Rights and safety
- Rights review: clear_with_restrictions
- Safety review: clear
- Redactions: 0

Artifact release forms:
- garpa-run-receipt-1: full. GARPA-authored synthetic receipt is redistributable.
- vendor-independent-run-1: citation. The source is represented by citation and digest only.

## Corrections
Counterevidence and correction requests: GARPA-PUBLICATION-0001 counterevidence intake

## Control boundary
This dossier contains only claims admitted by the publication gate. Blocked, superseded, unsupported, stale, unsafe, or rights-incompatible claims are excluded rather than softened into prose.
