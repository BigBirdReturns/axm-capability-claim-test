# GARPA public registry MCP server

This local server validates public case-registry entries and applies verified governing-release updates without rewriting prior releases or identity history.

## Start

```bash
cd mcp
npm install
npx tsx garpa-registry-server.ts
```

An MCP client can point at:

```text
npx tsx /ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/garpa-registry-server.ts
```

## Tools

### `validate_garpa_case_registry`

Validates either a registry entry or a release-update request. It checks:

```text
one current release
one current offering version
contiguous release numbers beginning at R1
matching current release pointers
unique release identifiers and manifest digests
unique version and lineage identifiers
source-addressable identity lineage
valid candidate release manifest
```

### `apply_garpa_registry_release`

Runs the update gate and returns a candidate next registry entry only when all controls pass. It blocks:

```text
case mismatch
stale expected current-release pointer
candidate release not verified current
skipped release number
incorrect prior-release digest or superseded release identifier
reused release identifier or manifest digest
rebrand or offering-name change without source-backed identity lineage
withdrawn cases or non-publication-ready transitions
```

An admitted update marks the previous current release `superseded`, appends the verified candidate as `current`, advances the governing pointers, preserves the old canonical subject as an alias when identity changes, and carries offering-version and lineage history forward.

## Trust boundary

The model may propose a registry update. It cannot make an unverified release current, skip release history, overwrite a prior digest, treat a rebrand as a new clean identity, reactivate a withdrawn case, or resolve a stale write by silently replacing the current registry pointer.
