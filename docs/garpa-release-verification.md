# GARPA immutable release verification

A publication-ready package becomes a release only after its payload files are placed under a content-addressed manifest. Release verification is independent from the prose renderer and can report that a release is intact even when the registry marks it superseded or withdrawn.

The sequence is:

```text
publication-ready package
  -> rendered payload files
  -> per-file SHA-256 and byte length
  -> release manifest
  -> manifest digest
  -> registry entry
  -> release verification
```

## Release manifest

Every payload file carries:

- a safe relative path using forward slashes;
- exact SHA-256 digest;
- byte length;
- optional media type;
- release role.

The manifest also records:

- release and case identifiers;
- monotonically increasing release number;
- publication-package digest;
- publication-gate receipt digest;
- prior-release lineage for releases after R1;
- superseded release identifier when applicable;
- creation time;
- current, superseded, or withdrawn state;
- manifest digest.

The payload list does not need to include the manifest itself. The caller computes the manifest digest over the canonical release-manifest representation used by the release tool and passes that digest to verification.

## Path safety

The validator rejects:

```text
absolute paths
Windows drive paths
backslashes
empty path segments
. or .. segments
duplicate manifest paths
duplicate observed paths
```

Release extraction or upload tooling must preserve the safe relative paths exactly.

## File verification

The verifier compares the manifest with the observed bundle and reports:

```text
file_missing
unexpected_file
file_digest_mismatch
file_length_mismatch
duplicate_path
unsafe_path
manifest_digest_mismatch
```

A changed file cannot remain hidden behind an unchanged filename or release identifier.

## Registry state

An intact release is classified as:

```text
current_valid
superseded_valid
withdrawn_valid
```

Integrity and currency are separate propositions. A superseded release may remain byte-perfect and available for audit, while the registry identifies a later governing release. A withdrawn release remains verifiable without being presented as current.

A registry mismatch is returned when:

- the registry case differs;
- the current release digest differs;
- manifest and registry states disagree;
- the release identifier is absent from current, superseded, and withdrawn sets.

## Release lineage

R2 and later require `priorReleaseDigest`. A superseding release does not overwrite R1. The public record can therefore show what changed, why it changed, and which release currently governs.

## Reference fixture

`examples/garpa-release/release-verification.json` contains a synthetic R1 manifest, five payload file records, matching observed records, and a current registry entry. The reference result is `current_valid` with five verified payload files.

Tests also lock:

- manifest mutation;
- missing and unexpected files;
- payload digest and length mutation;
- unsafe and duplicate paths;
- missing release lineage;
- intact but superseded releases;
- unknown registry identities.

## Control question

Can a reader prove that every byte in the release matches the manifest, identify whether the release is current, superseded, or withdrawn, and reconstruct the lineage without trusting the website, filename, or publisher's current narrative?
