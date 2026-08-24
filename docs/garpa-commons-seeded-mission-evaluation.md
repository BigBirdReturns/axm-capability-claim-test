# GARPA Commons-seeded mission evaluation

This stage closes the bounded target execution loop without treating one favorable execution as the qualification campaign.

```text
complete reservation ledger from one admitted Commons-seeded preflight
  + every corresponding Commons-seeded test-run request
  + exact deterministic run-result and receipt bindings
  + frozen target mission, qualification, as-built, scenario, and metric custody
  -> Commons campaign-custody and coverage gate
  -> existing custodied mission-evaluation gate
  -> matched | bounded_match | partial | failed | incomparable | unassessed
```

Every submitted test-run request is recomputed. The evaluation envelope binds each run identifier to its exact test-run result digest, receipt digest, scenario, reservation receipt, seeded preflight result, preflight receipt, as-built receipt, and qualification contract. The run-set digest is computed from the complete sorted binding ledger. Every run reserved by the governing campaign preflight must be submitted exactly once. Omitted reservations, additional ungoverned executions, duplicate identifiers, changed receipts, stale upstream digests, and mixed preflight campaigns fail closed or remain incomplete without evaluation authority.

Campaign sufficiency is separate from execution-receipt admission. For every frozen scenario, the gate counts admitted valid executions against `minimumValidRunsPerMetric`. For every qualification metric, it also preserves the frozen minimum sample count per run, total valid samples, pass, fail, inconclusive, not-measured, and sample-deficient run identifiers. Essential failures are not compensated by secondary metrics. A complete coherent campaign whose essential metric failed can be admitted as trustworthy evidence of `failed`.

Properly receipted aborted and invalidated executions remain in the campaign, pass through the ordinary custody adapter, and are excluded from substantive acceptance by the existing evaluator. Incomplete executions remain visible and prevent advancement when the frozen valid-run requirement is not satisfied. The Commons layer constructs a typed `MissionEvaluationScope` from the frozen target chain and calls `evaluateMissionAdequacyWithCustody`; it does not inspect repository fixtures, discover evaluator arguments, or implement a second outcome classifier.

The synthetic executable campaign uses ten exact reservations and ten valid target executions. Its scope is bounded to the controlled indoor, single-object target fixture and therefore resolves to `bounded_match` when all essential observations pass. The regression campaign also preserves a complete failed campaign, receipted abort and invalidation campaigns with ten remaining valid runs, omitted reservations, forged bindings, and false full-mission or qualification-transfer declarations.

Mission-evaluation admission does not establish vendor parity, unrestricted equivalence, deployment authority, or publication authority.
