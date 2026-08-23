# GARPA counterevidence and supersession

A GARPA release is immutable. New evidence may support, narrow, contradict, or invalidate part of the governing release, but it never edits the published bytes or silently replaces the historical record. Counterevidence re-enters the same evidence discipline used by the original case, receives a bounded review, and may produce a candidate successor release.

The sequence is:

```text
counterevidence packet
  -> packet validation
  -> evidence-cell review
  -> claim-effect assessment
  -> counterevidence disposition
  -> upstream rework when required
  -> candidate supersession receipt
  -> new publication package
  -> new release manifest
  -> registry update
```

## Counterevidence packet

A packet identifies:

- the exact case, release identifier, and release digest being challenged;
- one or more published claim identifiers;
- the submitter and relationship to the subject;
- source artifact identifiers;
- evidence-cell identifiers;
- the requested correction;
- submission time.

The packet proposes evidence. It cannot alter the target release, mark its own evidence admissible, or select the final disposition.

## Evidence review

Before a claim effect is assessed, every submitted evidence cell is placed in exactly one review partition:

```text
validated
The evidence cell passed the applicable source, version, venue, scope, and measurement checks.

duplicate
The evidence is already present in the case lineage and adds no new proposition, version, venue, fixture, method, result, or limitation.

rejected
The evidence does not support the requested correction or fails the applicable evidence gate.
```

A material claim effect such as `narrows`, `contradicts`, `requires_requalification`, or `new_offering_version` requires at least one validated evidence cell. A submitter relationship, vendor assertion, expert status, or requested outcome cannot substitute for that evidence.

## Claim effects

Each affected claim receives one effect:

```text
supports
The new evidence provides additional support without changing the current wording or scope.

narrows
The existing claim retains a supported core but requires a narrower version, scenario, environment, metric, tolerance, or accounting boundary.

contradicts
The new evidence materially conflicts with the governing claim.

requires_requalification
The new evidence identifies a fixture, configuration, metric, or environmental condition that requires a new qualification run before the claim can be republished.

new_offering_version
The evidence concerns a successor or materially different configuration rather than the version evaluated by the target release.

no_effect
The evidence does not change the target claim.
```

## Dispositions

The review gate returns one deterministic disposition:

```text
target_release_stale
The packet targets a release identifier or digest that is no longer the governing release.

insufficient
No submitted evidence cell passed review.

duplicative
The packet adds no new evidence lineage.

supports_current_release
The evidence strengthens the current record without changing the release claim.

narrows_current_release
One or more claims require a narrower successor release.

contradicts_current_release
One or more governing claims conflict with validated counterevidence.

requires_requalification
A new frozen qualification or regression set is required before correction.

requires_new_case_version
The evidence concerns a different offering version and must enter a linked versioned case record.
```

Supporting evidence may be recorded in the case without publishing a new release. Narrowing, contradiction, and requalification dispositions require a supersession path. A new offering version creates linked lineage rather than mutating the evaluated version.

## Supersession receipt

A candidate supersession receipt preserves:

- the prior release identifier, digest, and release number;
- the counterevidence packet identifier;
- the claims requiring change;
- the reason for supersession;
- required upstream actions;
- the proposed successor release identifier and number;
- creation time and receipt state.

The receipt does not make the successor current. The new case products must pass their applicable evidence, qualification, parity, publication, and release gates before the successor release is issued. The prior release remains byte-verifiable and visibly superseded rather than overwritten.

## Reference fixture

`examples/garpa-counterevidence/review-request.json` is synthetic. An independent repeat cell submits a same-fixture latency result that contradicts the synthetic parity claim `pub-parity-1` in R1. The review returns:

```text
disposition            contradicts_current_release
action                 prepare_superseding_release
accepted               true
supersession required  true
prior release preserved true
candidate successor    GARPA-PUBLICATION-0001-R2
```

The candidate receipt is stored in `examples/garpa-counterevidence/supersession-receipt.json`. It is not an issued R2 release and does not change the R1 registry state by itself.

## Control question

Can a vendor, customer, researcher, operator, or member of the public submit useful counterevidence while GARPA preserves the original release, validates the new evidence independently of the requested conclusion, identifies exactly which claim changes, and requires every corrected result to pass the same gates as the original?
