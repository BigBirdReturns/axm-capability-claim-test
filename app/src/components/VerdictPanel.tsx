import type { Report, SeamState, Verdict } from "../types/audit";

const VERDICT_LABELS: Record<Verdict["state"], string> = {
  A_capability_with_proof: "A — capability with proof",
  B_ahead_of_proof: "B — ahead of proof",
  C_costume_or_proof_substitution: "C — costume / proof substitution",
  unclassifiable: "Unclassifiable",
  not_supplied: "Analysis not supplied",
  not_applicable: "Not applicable",
};

const SEAM_LABELS: Record<SeamState, string> = {
  triggered: "triggered",
  not_triggered: "not triggered",
  unclear: "unclear",
  not_applicable: "not applicable",
};

// Verdict + seams. Seams carry formal states; not_applicable is shown but,
// per the method, never counted as weak signal.
export function VerdictPanel({ report }: { report: Report }) {
  const { seams, verdict, objectGate } = report;
  const isAllocator = objectGate.objectType === "capital_allocator";

  return (
    <section className="panel">
      <h2>{isAllocator ? "Attribution seams" : "Seams"}</h2>
      <p className="muted">
        {isAllocator
          ? "Allocator route: attribution, not product seams."
          : "Product route: ten forced questions."}
      </p>
      <ul className="seams">
        {(seams ?? []).map((s) => (
          <li key={s.id} className={`seam seam-${s.state}`}>
            <span className={`seam-state state-${s.state}`}>
              {SEAM_LABELS[s.state]}
            </span>
            <div className="seam-q">{s.question}</div>
            <div className="muted">{s.reason}</div>
          </li>
        ))}
      </ul>

      {verdict && (
        <>
          <h2>Verdict</h2>
          <dl className="kv">
            <dt>Operating proof</dt>
            <dd>
              {VERDICT_LABELS[verdict.state]} — loop {verdict.loop}
            </dd>
            <dt>Rationale</dt>
            <dd>{verdict.rationale}</dd>
            <dt>Largest gap</dt>
            <dd>{verdict.largestGap}</dd>
            <dt>Tense of proof</dt>
            <dd>{verdict.tenseOfProof}</dd>
            <dt>What would clear it</dt>
            <dd>{verdict.whatWouldClearIt}</dd>
            <dt>Roots — belief supplier</dt>
            <dd>{verdict.rootsBeliefSupplier}</dd>
            <dt>Roots — value retainer</dt>
            <dd>{verdict.rootsValueRetainer}</dd>
          </dl>
          {verdict.nextPulls.length > 0 && (
            <>
              <h3>Next pulls</h3>
              <ol>
                {verdict.nextPulls.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
      <p className="muted small">
        Structural assessment, not an allegation of wrongdoing.
      </p>
    </section>
  );
}
