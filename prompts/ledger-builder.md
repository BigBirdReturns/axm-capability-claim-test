# Ledger builder

Turns retrieved material into a schema-valid ledger. This is still the
retrieval/ledger layer — no analysis, no verdict.

## Output contract

Return JSON matching `schemas/ledger.schema.json`:

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Example Co",
  "context": "optional retrieval notes",
  "sources": [
    { "id": "s1", "title": "...", "url": "...", "publisher": "...", "date": "2025-01-01" }
  ],
  "claims": [
    {
      "id": "c1",
      "field": "capital_raised",
      "statement": "...",
      "evidenceClass": "confirmed",
      "confidence": 0.9,
      "sourceIds": ["s1"],
      "notes": "..."
    }
  ]
}
```

## Field keys

**Product company:** `capital_raised`, `valuation`, `competed_awards`,
`named_customer`, `performance_baseline`, `independent_verification`,
`production_status`, `ownership_posture`.

**Capital allocator:** `fund_size`, `lp_category`, `portfolio`,
`lead_investor_status`, `board_role`, `entry_timing`, `follow_on_outcomes`,
`founder_validation`, `attributable_wins`.

## Discipline

- One `field` per claim; multiple claims may share a field.
- A claim is **sourced** only if it cites at least one source id and its
  evidence class is not `open`.
- Do not invent sources. An unsourced item is class `open` with empty `sourceIds`.
