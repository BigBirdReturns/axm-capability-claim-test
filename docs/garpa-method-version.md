# GARPA method version

Current branch method version: `1.0.0-commons-seeded-preflight`.

The highest governed stage binds an admitted Commons-seeded as-built receipt to a target preflight receipt. The preflight record preserves the exact target fixture, instrumentation identities and configuration digests, calibration state, storage paths, clock policy, trained operator assignments, venue and activity authority, hazard controls, tested abort path, immutable readiness evidence, and unique run reservations for every frozen qualification scenario.

The Commons-specific gate recomputes the complete as-built predecessor, refuses changed upstream digests, verifies every readiness assertion, and then delegates terminal readiness to the repository's ordinary preflight gate. The ordinary gate remains authoritative for current manifest and qualification custody, assembled build state, material deviation closure, and the complete readiness vector.

A passing result authorizes only the exact reserved target runs under the receipted preflight boundary. It does not transfer source qualification, establish a test result, authorize an unreserved run, establish mission adequacy or vendor parity, permit deployment, or authorize publication. Any change to installed identity, firmware, configuration, fixture, instrumentation, operator, authority, hazard boundary, storage path, clock policy, abort mechanism, scenario, or run reservation invalidates preflight.
