# GARPA capability-commons catalog

The catalog is the durable, content-addressed projection of objects that passed capability-commons admission. It does not replace the source case, release, build receipt, run receipt, or admission receipt. It provides a governed index that preserves those coordinates and makes reusable observations discoverable without converting them into global facts.

The update path is:

```text
current catalog digest
  + validated commons admission request
  + recomputed commons admission result
  + one explicit operation per admitted object
  -> catalog update gate
  -> immutable object revision chains
  -> update receipt
```

## Revision law

Every catalog object has a stable catalog identifier, stable identity key, aliases, ordered revisions, and at most one current revision. A changed admitted object enters through `supersede`; the prior current revision becomes `superseded`, and the new revision points to it through `supersedesRevisionId`. An identical replay enters through `noop` and cannot advance either the catalog revision or the catalog digest.

The gate refuses:

- stale or internally inconsistent catalog digests;
- forged or stale commons-admission results;
- omitted operations or operations targeting blocked objects;
- two operations against the same catalog object in one update;
- stable-identity collisions;
- supersession against a stale current-revision pointer;
- changed content represented as a no-op;
- unchanged content represented as a supersession;
- regressing update timestamps.

The catalog and every stored object carry canonical SHA-256 digests produced by a portable pure TypeScript implementation. The digest excludes only the `catalogDigest` field itself. The update receipt is separate from the catalog and records the prior and resulting catalog revisions and digests, source release, actor, time, and applied or idempotent operations.

## Search law

Search may filter by text, object type, source case or release, function and interface identifiers, execution class, primitive maturity, component evidence state, and revision state. Current revisions are returned by default. Superseded and withdrawn revisions require explicit inclusion.

Every hit carries:

- catalog object and revision identifiers;
- revision state and canonical identity key;
- source case, source release, and source release digest;
- execution class and maturity or evidence state where applicable;
- fixture and environment where applicable;
- residuals and falsification conditions;
- the complete stored object.

Search deliberately emits no scalar quality or relevance score. Deterministic text matching identifies the fields that matched, while provenance and scope remain available for the next case's own gates.

## Reuse boundary

Catalog presence does not establish global component qualification, universal substitution, current release status, unrestricted mission equivalence, or fitness for a new operating environment. A future case may use the catalog to prioritize retrieval and candidate composition, but it must still pass its own evidence, interface, architecture, qualification, and execution gates.
