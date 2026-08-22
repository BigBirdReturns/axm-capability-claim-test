# GARPA admission route

The GARPA route turns an arbitrary public offering artifact into a bounded
engineering-admission decision. It does not generate a parts list from a launch
post. It first preserves what was claimed, identifies which proposition each
source actually supports, separates the customer outcome from the vendor's
architecture, and returns the furthest stage the evidence admits.

## Trust boundary

The model performs extraction and proposes structured objects. Shared
TypeScript gates decide whether those objects are admissible.

A claimant publication can establish that the claimant made a statement. It
cannot, by itself, establish measured performance, independent verification, a
deployment outside the claimant's account, an operator-owned requirement, or a
comparable economic baseline.

The route therefore keeps these propositions separate:

```text
claim was made
operator need exists
deployment occurred
performance was observed
cost was observed under a stated boundary
local reproduction produced a result
```

## Sequence

```text
artifact
  -> claim packet validation
  -> attribution-safe capability_offering ledger
  -> ordinary sourcing gate
  -> offering evidence gate
  -> mission outcome validation
  -> goal gate
  -> architecture admission or a precise pull-list
```

The existing Capability Claim Test sourcing gate still runs. GARPA then applies
stricter requirements before architecture work is permitted.

## Claim packet

A claim packet preserves:

- the exact claimant, offering, capture date, and version when known;
- immutable artifact records and locators;
- evidence target, venue, and control;
- scoped offering claims and limitations;
- conflicts without collapsing them.

The packet compiles into the existing `Ledger` contract. Claimant-controlled
statements are rendered as attribution, for example:

```text
Swarmer states: Vectus is designed to protect high-value sites.
```

They are not rendered as observed operating results.

## Architecture admission

The offering evidence gate requires an evidenced offering identity and
advertised outcome before a mission hypothesis can proceed. Architecture work
additionally requires evidence for:

```text
offering version
operator need
operating environment
complete system boundary
comparable economic baseline
```

The goal gate independently requires:

```text
operator
protected or affected object
problem or threat
desired state change
operating environment
time and coverage requirement
baseline
at least one evidence-bound falsifiable success metric with a threshold
```

Every requirement must be explicitly stated, externally supported, or derived
from cited evidence. Analyst hypotheses remain visible but cannot unlock
architecture.

## MCP tools

The initial route is exposed through three MCP tools:

- `generate_garpa_intake_prompt` returns the neutral extraction contract for an
  arbitrary artifact.
- `validate_claim_packet` validates references and evidence-target policy.
- `run_garpa_admission` compiles the ledger, runs all admission gates, and
  returns the furthest admitted stage plus blocking reasons and a pull-list.

A normal model-driven loop is:

```text
1. Call generate_garpa_intake_prompt.
2. Read the supplied artifact as untrusted evidence.
3. Produce claimPacket and missionOutcome JSON.
4. Call validate_claim_packet.
5. Call run_garpa_admission.
6. Retrieve the missing evidence named by the result, or stop at the admitted
   stage. Do not generate an architecture unless architectureReady is true.
```

## First fixture

`examples/garpa-vectus/` captures the visible claims in a Swarmer launch post.
The post supplies enough source-backed fields to open the ordinary three-field
sourcing gate because it proves that several advertised claims were made. GARPA
still returns:

```text
admittedThrough: goal_hypothesis
architectureReady: false
```

The unresolved fields include the exact offering version, operator record,
operating environment, time and coverage requirement, complete system and cost
boundary, numerical comparator, and falsifiable success threshold.

The fixture models no active countermeasure and establishes no deployment,
measured performance, independent verification, or product-level parity.
