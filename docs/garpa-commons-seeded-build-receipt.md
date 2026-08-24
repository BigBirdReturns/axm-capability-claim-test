# GARPA Commons-seeded as-built receipt

This stage separates a frozen build manifest from evidence that the target system was actually assembled.

```text
admitted Commons-seeded build manifest
  + exact installed identities
  + serial or lot custody
  + firmware and configuration custody
  + calibration and assembly receipts
  + substitutions and deviations
  + actual cost and labor
  + immutable artifacts
  -> as-built receipt gate
  -> target preflight
```

The frozen manifest describes the expected build. The as-built receipt describes the installed build. A component appearing in the manifest does not prove that it was acquired, installed, configured, calibrated, connected, or verified.

Every manifest component must have exactly one installed-component receipt. Exact model or version, quantity, configuration digest, and firmware or runtime must match the frozen manifest. Hardware under `record_each` custody requires one serial or lot identifier per installed unit. Every referenced acquisition, installation, calibration, assembly, cost, and labor artifact must resolve to an immutable artifact record.

Every frozen calibration-plan item and assembly step must have a passing execution receipt under the exact subject and scope. Failed, skipped, inconclusive, reworked, and superseded activity remains visible. An executed substitution of a Commons-seeded component is refused because it invalidates the source-bound projection, target substitution, architecture, qualification, and manifest chain.

Actual costs must trace every expected architecture cost line. Actual labor is recorded separately by category and actor. A hardware bill of materials cannot conceal integration, debugging, calibration, qualification preparation, or documentation labor.

The following claims remain structurally false:

```text
qualificationTransferred   = false
missionEquivalenceClaimed  = false
```

A passing receipt means the exact assembled target is sufficiently receipted to enter target preflight. It does not authorize a test run, deployment, vendor parity, publication, or a capability-equivalence claim.
