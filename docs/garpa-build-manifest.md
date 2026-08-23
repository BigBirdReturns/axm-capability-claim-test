# GARPA build manifest

The build manifest freezes the exact intended implementation after qualification has been admitted and before procurement or assembly begins. It turns a candidate architecture into a versioned component, software, interface, role, instrumentation, calibration, substitution, and assembly package.

The sequence is:

```text
admitted qualification contract
    -> exact build manifest
    -> calibration and substitution policy
    -> sequenced assembly steps
    -> build-manifest gate
```

Passing this gate permits controlled assembly. It does not prove that the listed items were acquired, installed, calibrated, integrated, or tested. Those propositions belong to build and test receipts.

## Exact identity and configuration

Every selected architecture component must appear with the exact model or software version admitted by the substitution plan, the architecture quantity, supplier or source, unit cost, currency, configuration digest, runtime or firmware version, function and interface coverage, and serial or lot policy. Software preserves the admitted license. Hardware requires serial or lot custody.

Custom code additionally requires a source commit, package digest, dependency-lock digest, configuration digest, and executable installation procedure.

## Interface, labor, and dependency custody

Every selected compatibility edge remains in the manifest with the qualification metrics that will verify it. Human roles preserve staffing, training, responsibilities, and authority. External services and datasets preserve exact versions, availability checks, and fallbacks.

## Instrumentation and calibration

Every instrument in the frozen qualification contract appears with its exact version, configuration digest, calibration state, and storage path. Components that require calibration and instruments marked current require a calibration-plan item with a method, acceptance condition, evidence pattern, and owner.

## Substitution and assembly

Every selected component receives a governed replacement policy. An unavailable item cannot be swapped informally. The manifest states whether substitution is prohibited, requires regression tests, or returns the architecture to review.

Assembly steps are ordered by explicit predecessors and include procedures, acceptance conditions, rollback, owners, installed components, custom code, and verified compatibility edges. Cycles and uncovered items are refused.

## Synthetic fixture

`examples/garpa-synthetic-observation/build-manifest.json` freezes the three synthetic components, both compatibility edges, the operator role, two instruments, two calibration items, three substitution policies, three assembly steps, and the complete architecture cost and schedule trace. It advances only to `admitted_for_assembly`; no as-built or measured claim exists.
