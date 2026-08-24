# GARPA Commons-seeded build manifest

This stage freezes the exact target implementation after a Commons-seeded qualification contract reaches the existing `admitted_for_build_manifest` state.

```text
seeded-qualification result
  + canonical target architecture digest
  + canonical target qualification-contract digest
  + exact BuildManifest
  + seeded-component build bindings
  -> seeded build-custody gate
  -> existing build-manifest validator and gate
```

## Seeded build custody

Every Commons-seeded component receives one build binding that preserves its exact catalog object, revision, object digest, frozen qualification binding, architecture selection, architecture configuration, manifest component record, replacement policy, calibration or preassembly verification items, and every assembly step that touches the component.

The manifest component must preserve the projected component identifier, kind, exact model or version, selected quantity, target-case license and price boundary, target function and interface mapping, and the qualified firmware or software version. Its `configurationDigest` is the canonical digest of the admitted architecture configuration.

Every seeded component uses `no_substitution`. The policy retains every target qualification metric that closes a source-required rerun or a seeded architecture risk or residual. Any replacement requires a new Commons projection, target substitution, architecture, qualification, and build-manifest chain.

At least one calibration or preassembly verification item must address each seeded component. Every assembly step that inventories, installs, configures, calibrates, integrates, or verifies that component remains named in the binding.

## Existing build-manifest gate

The Commons-specific layer does not decide whether target-only components, custom code, compatibility edges, human roles, dependencies, instrumentation, calibration, replacement policies, assembly ordering, or architecture cost and schedule lines are complete. Those obligations remain controlled by `validateBuildManifest` and `runBuildManifestGate`.

A passing result reaches the existing `admitted_for_assembly` state. This state authorizes controlled assembly under the frozen manifest only. It does not prove acquisition, installation, calibration, integration, execution, measured performance, deployment fitness, vendor parity, publication authority, or mission equivalence.

## Synthetic executable fixture

`examples/garpa-commons-seeded-build-manifest/build-manifest.json` freezes the exact target sensor, detector, and operator UI; both target compatibility edges; the target operator role; qualification instrumentation; calibration and verification items; replacement policies; ordered assembly steps; and every target cost and schedule line.

The Commons-seeded sensor remains bound to `sensor-v1`, firmware `1.0.0`, the exact source revision, target function `f-observe-target`, interfaces `i-world-target` and `i-observation-target`, both qualification metrics, one sensor verification item, and all three assembly steps that touch it. The complete fixture delegates to the existing build-manifest gate and reaches `admitted_for_assembly` without manufacturing an as-built receipt or execution authority.
