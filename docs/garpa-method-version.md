# GARPA method version

Current branch method version: `1.5.0-commons-seeded-release-verification`.

The highest governed stage is `commons_seeded_release_verification`. It recomputes the exact publication-ready chain, generates every mandatory public and evidentiary release file, recomputes UTF-8 byte lengths and SHA-256 digests, binds the initial current R1 manifest, and delegates integrity decisions to the existing release-manifest and release-bundle verifiers.

Release verification establishes the integrity of one exact candidate bundle. It does not mean that public release occurred, the public registry was updated, deployment was authorized, or unrestricted product equivalence was established.
