# GARPA Public Dossier — GARPA Commons-seeded target observation system

## Release disposition
- Case: GARPA-COMMONS-TARGET-0001
- Disposition: compose
- Audience: public
- Claim report: dbc3037f908de185dc56eab0ae3a7f4ac3d04ba79a695b252a4cd19f39b0b796
- Mission evaluation: 67676c16e38984f1c022c8e5f8cf39a925a60bf6bb37407fe0d9a4ba179196cf
- Mission state: Not available
- Vendor parity evaluation: f5c6c9f8bd7e6531ba54bf871a79723a6d30e2c967900baa166375d82c72baf2
- Vendor parity state: same_fixture_match

## Admitted claims

### pub-mission-1 · mission_evaluation

Under the frozen bounded scenarios and metrics, GARPA build 50570f5f4fafe15453d103a8024a3ad12b92308fe799357ccdffe093bae3a01b satisfied the evaluated mission slice.

Scope:
- Offering version: Not applicable or unresolved
- Build digest: 50570f5f4fafe15453d103a8024a3ad12b92308fe799357ccdffe093bae3a01b
- Scenarios: scenario-target-nominal
- Metrics: q-target-detection, q-target-latency
- Environment: Controlled indoor single-object target fixture with the frozen target class, isolated network, one trained operator, and no active response or operational deployment.
- Evaluation period: Not applicable

Support:
- evaluated_by: 67676c16e38984f1c022c8e5f8cf39a925a60bf6bb37407fe0d9a4ba179196cf. Frozen GARPA mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-001. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-002. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-003. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-004. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-005. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-006. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-007. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-008. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-009. Admitted test-run receipt used by the mission evaluation.
- measured_by: GARPA-COMMONS-EVAL-RUN-010. Admitted test-run receipt used by the mission evaluation.

Limitations:
- Evaluation covers a bounded mission slice: Controlled indoor single-object target fixture with the frozen target class, isolated network, one trained operator, and no active response or operational deployment.

Prohibited generalizations:
- Do not generalize beyond the frozen scenarios, metrics, environment, build, or qualification contract.
- Do not convert a bounded mission result into unrestricted product-level or operational equivalence.

### pub-parity-1 · vendor_parity

Against Synthetic Vendor Reference System version reference-1.0.0, GARPA matched the required metrics q-target-detection, q-target-latency under the same frozen fixture and measurement method.

Scope:
- Offering version: reference-1.0.0
- Build digest: 50570f5f4fafe15453d103a8024a3ad12b92308fe799357ccdffe093bae3a01b
- Scenarios: scenario-target-nominal
- Metrics: q-target-detection, q-target-latency
- Environment: Parity, when supported, is confined to the frozen bounded mission evaluation, exact vendor version, same fixture, same method, required metrics, and aligned accounting boundary where cost is compared.
- Evaluation period: Not applicable

Support:
- evaluated_by: f5c6c9f8bd7e6531ba54bf871a79723a6d30e2c967900baa166375d82c72baf2. Exact-version vendor parity evaluation.

Limitations:
- Parity, when supported, is confined to the frozen bounded mission evaluation, exact vendor version, same fixture, same method, required metrics, and aligned accounting boundary where cost is compared.

Prohibited generalizations:
- Do not claim unrestricted full-system, field, operational, or lifecycle equivalence.
- Do not extend parity to unmeasured metrics or other vendor versions.

### pub-residual-1 · residual

Evaluation covers a bounded mission slice: Controlled indoor single-object target fixture with the frozen target class, isolated network, one trained operator, and no active response or operational deployment.

Scope:
- Offering version: Not applicable or unresolved
- Build digest: 50570f5f4fafe15453d103a8024a3ad12b92308fe799357ccdffe093bae3a01b
- Scenarios: scenario-target-nominal
- Metrics: q-target-detection, q-target-latency
- Environment: Controlled indoor single-object target fixture with the frozen target class, isolated network, one trained operator, and no active response or operational deployment.
- Evaluation period: Not applicable

Support:
- limited_by: 67676c16e38984f1c022c8e5f8cf39a925a60bf6bb37407fe0d9a4ba179196cf. Residual carried from the mission evaluation.
- evaluated_by: 67676c16e38984f1c022c8e5f8cf39a925a60bf6bb37407fe0d9a4ba179196cf. The admitted evaluation established this mandatory residual.

Limitations:
- None recorded.

Prohibited generalizations:
- Do not omit this residual from any release that carries the associated mission claim.

## Failure and contradiction history
Disclosed failures:
- None recorded.

Disclosed contradictions:
- None recorded.

## Rights and safety
- Rights review: clear
- Safety review: clear
- Redactions: 0

Artifact release forms:
- No artifacts included.

## Corrections
Counterevidence and correction requests: No correction contact supplied.

## Control boundary
This dossier contains only claims admitted by the publication gate. Blocked, superseded, unsupported, stale, unsafe, or rights-incompatible claims are excluded rather than softened into prose.
