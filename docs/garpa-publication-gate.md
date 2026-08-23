# GARPA publication claims and release gate

The publication layer is downstream of evidence, architecture, execution, mission evaluation, and vendor parity. It converts governed receipts into bounded claims and refuses to publish a stronger proposition than the current upstream state supports.

The sequence is:

```text
current upstream receipts
  -> typed publication claims
  -> claim-support graph
  -> rights decisions
  -> safety review
  -> redaction review
  -> failure and contradiction disclosure
  -> publication gate
  -> public dossier or block receipt
```

A model may draft language. Code determines whether each claim has support, current digests, admissible scope, aligned accounting, release rights, safety clearance, and a correction path.

## Publication claims

Every substantive statement is a `PublicationClaim` with:

- a claim class;
- the subject and case;
- exact offering version where applicable;
- build, scenario, metric, environment, and evaluation-period scope;
- evidence, run, evaluation, or cost coordinates;
- limitations;
- prohibited generalizations;
- lifecycle state.

The supported classes are:

```text
source_attribution
evidence_summary
local_measurement
bounded_inference
mission_evaluation
cost_comparison
vendor_parity
residual
open_question
```

The compiler uses deterministic grammar. It says that a claimant stated something, GARPA measured something, a frozen mission evaluation reached a state, or an exact-version same-fixture parity evaluation matched named metrics. It does not use `proven`, `equivalent`, `cheaper`, `operational`, or similar language without the corresponding gate state.

## Claim support

Each support edge records a relation and an exact coordinate:

```text
direct_source
derived_from
measured_by
evaluated_by
costed_by
limited_by
contradicted_by
```

Substantive claims require positive support. Local measurements require run-receipt coordinates. Mission claims must cite the governing mission-evaluation digest. Vendor parity claims must cite the governing parity-evaluation digest. Residuals must remain tied to the limiting evaluation that produced them.

## Scope controls

A bounded mission claim must include the frozen scenarios, metrics, limitations, and prohibited generalizations. A vendor parity claim additionally requires:

- upstream state `same_fixture_match`;
- exact vendor version;
- compared metric identifiers;
- parity limitations;
- prohibited full-system generalizations.

If upstream parity is missing, reported-only, mismatched, negative, or incomparable, the compiler produces a residual rather than a parity claim.

## Cost controls

A cost comparison requires cost-line coordinates, an explicit evaluation period, and upstream accounting comparability `aligned`. A hardware bill of materials cannot be compared with a managed-service price while labor, qualification, maintenance, communications, replacement, or sustainment boundaries differ.

## History controls

Known failed runs and contradictory evidence remain in the publication package. The gate blocks release when any known failure or contradiction is absent from the disclosed history.

A safety rationale, sponsor preference, or concise narrative cannot remove a material failure from the record.

## Rights and release forms

Each artifact receives a rights class and release decision. Release forms are:

```text
full
excerpt
citation
digest_only
withheld
```

Full release is allowed only for redistributable, public-domain, or open-license artifacts. Quotation-only sources may be excerpted. Citation-only, restricted, permission-required, and unknown-rights sources may be cited, represented by digest, or withheld, but not redistributed as source bytes.

## Safety and redaction

The safety review may be:

```text
clear
clear_with_redactions
controlled_release_only
blocked
```

Redactions state whether they have no evidentiary effect, narrow a claim, block a claim, or require a controlled release. A public release is blocked when redaction removes the only support for a claim or when the remaining material requires controlled distribution.

Redaction cannot conceal failed runs, omitted costs, operator interventions, incompatible components, or residual capability gaps.

## Gate states

```text
upstream_receipt_stale
claim_support_incomplete
scope_overstated
contradiction_omitted
failure_history_incomplete
cost_boundary_misaligned
rights_unresolved
safety_review_blocked
redaction_invalidates_claim
publication_ready
```

The dossier renderer emits admitted claims only when the package reaches `publication_ready`. A blocked package produces a block receipt with findings and exact corrective actions rather than a softened public narrative.

## Reference fixture

`examples/garpa-publication/publication-package.json` is synthetic. It publishes:

- one bounded mission-evaluation claim;
- the residual that limits the mission claim;
- one exact-version same-fixture parity claim;
- the earlier aborted run in the disclosed failure history;
- a full GARPA-authored receipt and citation-only vendor fixture evidence;
- a correction and counterevidence path.

The generated dossier is `examples/garpa-publication/public-dossier.md`.

## Control question

Can every sentence in a release be traced to a current source, run, evaluation, or cost coordinate while preserving the exact version, scope boundary, failure history, contradiction history, rights class, safety decision, redaction effect, and fact that would overturn it?
