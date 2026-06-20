import type { ContaminationResult, Ledger } from "../types/audit";
import { BUCKET_LABELS } from "../lib/runContaminationBucket";

// Contamination renders as a bucket with source-backed component reasons,
// never as a bare number. Internal scores are intentionally not displayed.
export function ContaminationPanel({
  result,
  ledger,
}: {
  result: ContaminationResult;
  ledger: Ledger;
}) {
  function sourceTitles(ids: string[]): string {
    return ids
      .map((id) => ledger.sources.find((s) => s.id === id)?.title ?? id)
      .join("; ");
  }

  return (
    <section className="panel">
      <h2>Capital contamination</h2>
      <p className={`bucket bucket-${result.bucket}`}>
        Bucket: {BUCKET_LABELS[result.bucket]}
      </p>
      <p className="muted">
        The discount you apply to network-produced legitimacy — not bad money,
        not fakeness. Components with source-backed reasons only.
      </p>
      <ul className="components">
        {result.components.map((c) => (
          <li key={c.key} className={c.present ? "comp present" : "comp"}>
            <strong>{c.label}</strong>{" "}
            <span className="tag">{c.present ? "present" : "not source-backed"}</span>
            <div>{c.reason}</div>
            {c.sourceIds.length > 0 && (
              <div className="muted small">Sources: {sourceTitles(c.sourceIds)}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
