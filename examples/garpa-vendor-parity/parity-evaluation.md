# GARPA Vendor Parity Evaluation — GARPA-PARITY-0001

## Disposition
- Vendor offering: Synthetic Vendor Reference System
- Vendor version: reference-1.0.0
- Parity state: same_fixture_match
- GARPA build receipt: build-receipt-digest-1
- Qualification contract: qualification-digest-1

## Metric results
- Detection before boundary crossing: match. GARPA matches the vendor observation under the same fixture and method within the admitted tolerance.
- Median operator-presentation latency: match. GARPA matches the vendor observation under the same fixture and method within the admitted tolerance.

## Supported parity claims
- Detection before boundary crossing matched the exact-version vendor observation under the same fixture and method within the admitted tolerance.
- Median operator-presentation latency matched the exact-version vendor observation under the same fixture and method within the admitted tolerance.

## Unsupported parity claims
- The comparison does not establish full-mission or unrestricted product-level equivalence outside the frozen GARPA boundary.

## Largest gap
No required same-fixture metric gap remains inside the evaluated boundary.

## What would resolve it
A valid same-fixture repeat that misses any required metric would overturn the parity result.

## Scope boundary
Parity, when supported, is confined to the frozen bounded mission evaluation, exact vendor version, same fixture, same method, required metrics, and aligned accounting boundary where cost is compared.

## Falsification line
Repeat the same fixture and method against either exact configuration. Any valid miss on a required metric overturns the parity result.
