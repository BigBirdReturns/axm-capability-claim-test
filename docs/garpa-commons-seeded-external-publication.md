# GARPA Commons-seeded external-publication receipt

This stage accepts external publication or distribution evidence only after the exact Commons-seeded public-registry result has been recomputed and admitted.

The ordinary receipt gate distinguishes two evidence classes. `synthetic_qualification` exercises the receipt, artifact, digest, locator, chronology, and event-semantics machinery while keeping every real-world occurrence flag false. `observed_external` requires a non-synthetic locator and event-specific occurrence state for either `registry_entry_published` or `release_bundle_distributed`.

Each receipt binds the exact case, current release identifier, release-manifest digest, release-bundle digest, complete registry-entry digest, event kind, publisher, source locator, publication time, observation time, and captured UTF-8 evidence bytes. Every capture artifact is content-addressed and included in the exact receipt artifact ledger.

The Commons layer recomputes the complete public-registry predecessor, verifies the current release pointer, and delegates receipt semantics to the ordinary external-publication gate. It does not promote a synthetic fixture into an observed event and does not suppress a valid observed event.

An admitted observed receipt proves only the exact event at the exact locator during the recorded observation window. It does not establish permanence, discoverability, audience reach, continued availability, deployment authority, or unrestricted product equivalence.
