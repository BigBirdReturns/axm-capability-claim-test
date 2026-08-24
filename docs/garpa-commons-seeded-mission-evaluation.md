# GARPA Commons-seeded mission evaluation

This stage closes the target execution loop without treating one favorable run as the qualification result.

```text
admitted Commons-seeded test-run receipts
  + exact complete run set
  + immutable run-to-evaluation bindings
  + existing custodied mission-evaluation request
  -> Commons run-set custody gate
  -> existing custodied mission-evaluation gate
  -> matched | bounded_match | partial | failed | incomparable | unassessed
```

Every submitted test-run request is recomputed. The evaluation envelope binds each run identifier to the exact test-run result digest, receipt digest, scenario, target case, qualification contract, as-built receipt, and preflight receipt. The complete delegated evaluation must contain the exact same run receipts. Omitted runs, unbound additional runs, changed receipts, stale upstream digests, duplicate run identifiers, and insufficient valid scenario coverage fail closed.

Test-run receipt admission and mission adequacy are different propositions. A valid execution with a failed threshold remains valid evidence of failure. Aborted, invalidated, and incomplete runs remain in the record and cannot be silently removed. The existing custodied mission-evaluation gate remains the substantive authority for the bounded mission state.

Mission-evaluation admission does not establish vendor parity, unrestricted equivalence, deployment authority, or publication authority.
