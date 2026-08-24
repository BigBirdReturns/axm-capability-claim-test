# GARPA Commons-seeded public registry admission

This stage admits the exact verified current R1 as the sole governing release inside the case registry without inventing prior history, identity lineage, external publication, deployment authority, or unrestricted equivalence.

```text
qualified Commons-seeded release verification
  + exact current_valid R1 manifest and bundle
  + deterministic empty current release ledger
  + exact publication subject and disposition
  + one manifest-bound current version coordinate
  + existing registry update request
  -> Commons registry-custody gate
  -> existing registry update and application gate
  -> registry_update_admitted
```

The initial current entry contains the admitted publication subject, no aliases, no claimant or organization assertions, no prior versions, no identity lineage, no tags, no releases, and no current release pointers. The deterministic identity patch adds only one current version whose exact version and evidence coordinate are the verified release-manifest digest.

The existing registry gate remains authoritative for exact case identity, current-pointer concurrency, contiguous release numbering, release lineage, release identifier reuse, identity lineage, current-valid verification, case-state transition, disposition, and non-regressing update time.

Registry-record admission and external publication are distinct. The result may establish the sole governing release pointer inside the case record, but `publicRegistryPublished` and `publicReleaseOccurred` remain structurally false until separate external distribution and publication receipts exist. Registry admission does not authorize deployment or unrestricted equivalence.
