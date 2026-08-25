# GARPA Commons-seeded external distribution

The external-distribution stage begins with the exact qualified Commons-seeded public-registry receipt. It does not infer that publication occurred from registry admission, bundle integrity, a release URL supplied by the caller, or a claimant statement.

## Receipt modes

`qualification_fixture` exercises the complete custody surface with a synthetic, inaccessible `urn:garpa:qualification-fixture:` destination. A fixture receipt may be admitted, but `eventObserved`, `publicReleaseOccurred`, and `publicRegistryPublished` remain false.

`observed_external_event` requires an externally accessible HTTPS destination, the complete governing release file set with exact SHA-256 digests and byte lengths, an externally attributable platform receipt, an independent or locally measured retrieval capture, and a registry snapshot when public-registry publication is asserted.

## Event kinds

The event kind is one of `release_distribution`, `registry_publication`, or `release_and_registry_publication`. The result flags are derived from the observed-event mode and event kind. Callers cannot promote a fixture or a release-only event into a registry-publication record by changing the envelope flags.

## Custody

The observation, evidence-artifact set, observed file set, envelope, upstream public-registry result, governing release manifest, release bundle, and registry entry are all bound by canonical SHA-256 digests. Evidence artifacts must be content addressed and captured between the asserted publication time and observation time.

## Boundary

An admitted observed external event establishes only that the exact governed bytes and registry record were externally observed at the supplied destination under the admitted evidence controls. It does not authorize deployment or establish unrestricted product equivalence. The generated qualification example remains a fixture and must never be represented as a real external event.
