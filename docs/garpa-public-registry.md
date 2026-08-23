# GARPA public case registry and identity lineage

The public case registry identifies which release currently governs a case while preserving every prior release, offering version, alias, rebrand, successor relationship, disposition, and source-backed identity transition. The registry is a pointer and lineage organ. It does not replace release manifests or rewrite case evidence.

The update sequence is:

```text
verified current release
  -> current registry entry
  -> expected current-release check
  -> release-number and prior-digest check
  -> identity-lineage check
  -> registry update gate
  -> new governing pointer
  -> preserved prior release history
```

## Registry entry

Each case entry records:

- durable case identifier;
- canonical subject and aliases;
- claimant, organization, and offering where known;
- exact offering-version records and their source artifacts;
- source-backed identity lineage;
- domain and capability tags;
- current case state and disposition;
- every release identifier, number, digest, state, and lineage coordinate;
- current release identifier and digest;
- creation and update times.

The registry permits at most one current release and one current offering version. Release numbers must form a contiguous sequence beginning at R1. Current pointers must match the current release record exactly.

## Release update gate

A governing-release update requires:

- candidate and registry case identifiers to match;
- the update to name the exact current release identifier and digest it was prepared against;
- a candidate release verified as `current_valid` and carrying manifest state `current`;
- the next contiguous release number;
- R2 and later to point to the exact current release through `priorReleaseDigest` and `supersedesReleaseId`;
- a distinct release identifier and manifest digest;
- publication-ready case state;
- a nonwithdrawn case and nonregressing update time.

The gate blocks stale write attempts rather than allowing the last writer to silently replace a newer registry pointer.

## Identity lineage

A changed canonical subject or offering name requires a source-backed lineage link. The supported relations are:

```text
same_offering
rebrand
successor
predecessor
acquired_brand
organizational_transfer
```

A rebrand without lineage is blocked. A source-backed rebrand preserves the prior canonical subject as an alias, adds the new version record, and retains the original case and release history. Rebranding therefore cannot create an apparently clean object with no connection to the evidence evaluated under the prior name.

## Applying an admitted update

When the gate passes:

- the previous current release becomes `superseded`;
- the candidate release becomes `current`;
- the current release pointers advance to the new identifier and digest;
- the prior release record remains intact;
- a former canonical subject becomes an alias when the canonical identity changes;
- prior current versions become `superseded` when a new current version is added;
- source-backed lineage links and tags are appended;
- the case state and disposition are updated.

A failed gate returns findings and required actions without producing a candidate registry entry.

## Reference fixture

`examples/garpa-registry/registry-update.json` advances the synthetic case from R1 to R2 after a candidate supersession. The admitted update preserves R1 as superseded, installs R2 as current, and advances the current digest from the R1 manifest to the R2 manifest.

Regression tests also lock:

- stale expected current pointers;
- skipped release numbers;
- incorrect prior-release lineage;
- reused release identifiers or digests;
- noncurrent verification states;
- rebrands without identity evidence;
- withdrawn cases;
- source-backed rebrands that preserve the old subject and version lineage.

## Control question

Can a reader determine which release governs, verify every prior release, trace rebrands and successor configurations to source artifacts, and distinguish a corrected release from a renamed attempt to escape the original case history?
