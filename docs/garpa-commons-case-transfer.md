# GARPA commons case transfer

The Capability Commons is an evidence-preserving memory surface. It is not a global product rating, approved-parts list, or architecture authority. This layer governs how a new GARPA case may consult that memory without importing the prior case's conclusions.

```text
admitted target capability graph
  + exact content-addressed commons catalog
  -> deterministic function and interface retrieval plan
  -> exact revision nominations
  -> source-to-target scope comparison
  -> research leads or candidate inputs
```

## Retrieval plan

The plan is generated only when the target capability graph carries a current `admitted_for_substitution` receipt bound to the canonical graph digest. Each required implementation-neutral function and every connected interface receives its own retrieval task. A task uses independent text and exact-identifier queries, then returns the union of source-bound hits. No relevance score is created.

Each hit preserves the catalog object, immutable revision, object digest, source case, source release and release digest, matched target tasks, and complete stored Commons object.

## Transfer gate

A nomination must identify one exact catalog revision and one permitted use:

```text
capability primitive       capability_decomposition_hint
component observation      component_retrieval_lead
architecture pattern       architecture_pattern_hint
```

The gate verifies the catalog and graph digests, graph-admission receipt, deterministic retrieval plan, exact object digest, revision state, target function and interface mappings, environment comparison, execution-class comparison, source residuals, source limitations, primitive falsification conditions, pattern failure modes, and target-case evidence and qualification work.

Current exact-version component observations may become `candidate_input` only when the source is locally qualified, the structured environment is identical, the source execution class is at least as demanding, no mismatch is hidden, and target evidence pulls and requalification tests are named. `candidate_input` is still a nomination. It is not a `ComponentCandidate` and cannot satisfy the existing substitution gate.

Primitives and architecture patterns remain `research_lead`. Superseded revisions may be consulted only when historical research is explicit, and they can never become candidate inputs. Withdrawn revisions are refused.

## Non-transferable states

Commons retrieval and nomination cannot establish:

- target-case component evidence;
- component or interface compatibility;
- essential-function or interface coverage;
- architecture selection;
- qualification, procurement, test, or deployment authority;
- mission adequacy or vendor parity.

Those propositions remain under the target case's existing validators, substitution gate, architecture gate, qualification contract, execution receipts, and publication gate.
