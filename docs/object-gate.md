# Object gate

**Run first, always. Wrong object, wrong test.** The gate routes the user
before any seams appear, so a capital allocator can never be forced through the
product-company instrument.

## Routes

| Object type (`key`) | Route (`key`) | What you test | Field set |
|---|---|---|---|
| `product_company` | `operating_proof_contamination` | Does the capability work | product |
| `capital_allocator` | `attribution_proof_contamination` | Is the claimed judgment independently attributable | allocator |
| `integrator_platform` | `removal_test_operating_control_contamination` | Does the mission survive removal of the vendor | product |
| `ranking_validator_media` | `independence_proof_contamination` | Is the legitimacy it confers independent | product (no product seams) |
| `government_program_vehicle` | `removal_test_ownership` | Who owns the seams | product |
| `claim_only` | `claim_test` | Tense, source class, baseline, beneficiary | none |

## Enforced in code

`app/src/lib/runObjectGate.ts` maps the object type to its route from
`app/src/data/objectRoutes.ts`. The field set selects which load-bearing fields
the sourcing gate counts, and whether product seams render. Allocators show
attribution fields, never product seams.
