# Ledger authoring guide

The ledger is the data contract for the Capability Claim Test. Manual entry,
LLM-assisted retrieval, adapters, the MCP server, examples, and exports all meet
at this shape: `sources[]` plus `claims[]`, with optional analysis annotations.

The page does not retrieve facts for you and does not know the truth. A good
report depends on a good ledger.

## Minimum shape

A ledger must include:

- `schemaVersion: 1`
- `objectType`
- `targetName`
- `sources[]`
- `claims[]`

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Example Robotics",
  "sources": [],
  "claims": []
}
```

This is valid JSON, but it will not unlock a verdict. It has no sourced
load-bearing fields, so the app returns a neutral pull-list.

## Source-ID rule

Every claim cites sources by ID. A claim only counts if at least one `sourceIds[]`
entry resolves to an object in `sources[]`.

```json
{
  "sources": [
    {
      "id": "s1",
      "title": "Award notice",
      "url": "https://example.org/award-notice"
    }
  ],
  "claims": [
    {
      "field": "competed_awards",
      "statement": "Example Robotics won a competed public award.",
      "evidenceClass": "confirmed",
      "sourceIds": ["s1"]
    }
  ]
}
```

A claim that cites `"ghost"` when no source has `"id": "ghost"` is not sourced.
`validateLedger` reports that as an error, and the sourcing gate also refuses to
count phantom citations defensively.

## Evidence-class decision table

Never upgrade a claim beyond the source. Choose the weakest accurate class.

| Evidence class | Use when | Counts toward the three-field sourcing gate? |
|---|---|---|
| `confirmed` | The cited source is an authoritative primary record for the field: contract notice, public filing, customer announcement, audited document, official award record. | Yes |
| `reported` | The cited source reports the claim, but the source is not itself the primary record: news article, interview, company blog, third-party profile. | Yes |
| `derived` | The claim is mechanically inferred from cited public records: dates, cross-record timing, totals, or relationships that follow directly from sources. | Yes |
| `judgment` | The claim is an analyst interpretation or synthesis: quality, strength, significance, dependency, plausibility, or meaning. Keep the source trail, but label the interpretation honestly. | **No** |
| `open` | The field is unknown, unresolved, uncited, or still a question. | No |

Why `judgment` does not unlock a verdict: an analyst's interpretation is not
external evidence. Three sourced-looking judgment claims would defeat the point
of the sourcing gate, so judgments stay in the ledger and known-evidence trail
but do not count toward the threshold.

## Passing ledger example

This example passes the sourcing gate because three load-bearing fields cite real
sources and use external evidence classes (`confirmed`, `reported`, `derived`).
It may still produce `not_supplied` as the verdict if no analysis annotations are
provided; passing the sourcing gate only unlocks analysis.

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Example Robotics",
  "sources": [
    {
      "id": "s1",
      "title": "Official award notice",
      "url": "https://example.org/award"
    },
    {
      "id": "s2",
      "title": "Customer deployment announcement",
      "url": "https://example.org/customer"
    },
    {
      "id": "s3",
      "title": "Independent benchmark report",
      "url": "https://example.org/benchmark"
    }
  ],
  "claims": [
    {
      "field": "competed_awards",
      "statement": "Example Robotics received a competed award under a public program.",
      "evidenceClass": "confirmed",
      "sourceIds": ["s1"]
    },
    {
      "field": "named_customer",
      "statement": "A named customer announced a deployment with Example Robotics.",
      "evidenceClass": "reported",
      "sourceIds": ["s2"]
    },
    {
      "field": "performance_baseline",
      "statement": "The benchmark compares Example Robotics against a stated baseline.",
      "evidenceClass": "derived",
      "sourceIds": ["s3"]
    }
  ]
}
```

## Failing ledger example

This ledger does not pass, even though it has three claims:

- `capital_raised` is `judgment`, so it does not count toward the threshold.
- `valuation` is `open`, so it does not count.
- `named_customer` cites `ghost`, which does not resolve to a real source.

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Example Robotics",
  "sources": [
    {
      "id": "s1",
      "title": "Investor profile"
    }
  ],
  "claims": [
    {
      "field": "capital_raised",
      "statement": "The capital base appears strategically significant.",
      "evidenceClass": "judgment",
      "sourceIds": ["s1"]
    },
    {
      "field": "valuation",
      "statement": "Valuation not found.",
      "evidenceClass": "open",
      "sourceIds": []
    },
    {
      "field": "named_customer",
      "statement": "A customer appears to exist.",
      "evidenceClass": "reported",
      "sourceIds": ["ghost"]
    }
  ]
}
```

Fix it by replacing interpretive judgments with externally evidenced field
claims where available, keeping unresolved fields `open`, and making every
`sourceIds[]` entry point at a real source object.

## Writing good field statements

Good statements are narrow and source-shaped:

- Good: "The agency award notice names Example Robotics as awardee for program X."
- Weak: "Example Robotics is clearly validated by government demand."
- Good: "The customer announcement names Hospital Y as deploying product Z."
- Weak: "The company has real traction."
- Good: "The benchmark reports 92% accuracy against baseline B on dataset D."
- Weak: "Performance seems strong."

Keep interpretation in `judgment` claims, seam reasons, contamination reasons,
or verdict notes. Keep gate-unlocking field claims tied to external records.

## Optional analysis annotations

A ledger may also include `seams`, `contamination`, and `verdictNotes`. These are
analysis annotations, not retrieval facts. The app can render neutral defaults
when they are absent, but a finished report should include sourced reasons and a
falsification line (`whatWouldClearIt`).
