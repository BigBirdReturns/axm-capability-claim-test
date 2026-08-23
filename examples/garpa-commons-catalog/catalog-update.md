# GARPA Capability Commons Catalog Update

The executable fixture combines:

```text
examples/garpa-commons-catalog/empty-catalog.json
examples/garpa-commons/commons-request.json
examples/garpa-commons/commons-result.json
examples/garpa-commons-catalog/operations.json
```

The admitted update creates three revision chains in catalog revision 1:

```text
primitive-detect-before-boundary@1
observation-sensor-v1-controlled-fixture@1
pattern-observe-detect-present@1
```

Every revision retains its source case, source release, source release digest, canonical object digest, fixture and environment where applicable, maturity or evidence state, residuals, and falsification boundary. A changed object cannot overwrite revision 1. It must enter as revision 2 with `supersedesRevisionId` pointing to revision 1. An exact replay must use `noop` and cannot advance the catalog revision or digest.

Search returns the complete revision object and provenance context. It does not emit a scalar quality score or treat a prior fixture as qualification for a future case.
