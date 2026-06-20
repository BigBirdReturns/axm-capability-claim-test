# Contamination — a bucket, with reasons, never a bare number

Contamination is **not bad money and not fakeness**. It is the discount you
apply to network-produced legitimacy: how much of the validation, capital,
ranking, board legitimacy, and customer access comes from the same recurring
network that profits from the validation.

## The six components

1. **Cap-table circularity** — recurring consortium and its vehicles vs outside money.
2. **Validator circularity** — legitimacy from rankings/awards/events/media the same capital funds or grades.
3. **Broker origination** — first-checked/sourced/boarded by someone whose function is routing into that consortium.
4. **Lineage substitution** — famous names and ex-affiliations standing in for competed outcomes.
5. **Independent-demand inverse** — how thin competed external demand is against cumulative capital (compare like to like).
6. **Cross-holding density** — how much backers, board, primes, and validators recur across each other.

## Buckets

`clean` · `mixed` (network-dependent) · `circular` · `insufficient_data`.

## The rule

Score the **bucket, not a decimal**, and never report a bucket without its
sources. A component counts only when it is **present AND has a source-backed
reason**. Optional internal component scores may be stored, but the public
output is the bucket plus the components' reasons and sources.

Internal-only mapping (never rendered): 0–24 clean, 25–74 mixed, 75–100
circular. If nothing is source-backed, the bucket is `insufficient_data`.

## Enforced in code

`app/src/lib/runContaminationBucket.ts` returns `{ bucket, components[] }`. The
UI (`ContaminationPanel.tsx`) renders the bucket and each component's reason and
sources, and **never** displays a numeric score.
