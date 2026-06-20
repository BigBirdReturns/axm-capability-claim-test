import { useMemo } from "react";
import type { Report } from "../types/audit";
import { renderReportMarkdown } from "../lib/renderReport";

// Insufficient-ledger view + raw markdown preview. When the sourcing gate
// fails, only object type, route, known evidence, missing fields, and the
// neutral pull-list are shown.
export function ReportPreview({ report }: { report: Report }) {
  const md = useMemo(() => renderReportMarkdown(report), [report]);
  const blocked = !report.sourcingGate.passed;

  return (
    <section className="panel">
      {blocked && (
        <div className="block-notice">
          <h2>Verdict blocked — insufficient ledger</h2>
          <p>
            Fewer than {report.sourcingGate.required} load-bearing fields are
            sourced. The verdict panel is withheld by design. Returned instead:
            object type, route, known evidence, missing fields, and a neutral
            pull-list.
          </p>

          <h3>Known evidence</h3>
          {report.knownEvidence.length === 0 ? (
            <p className="muted">None sourced yet.</p>
          ) : (
            <ul>
              {report.knownEvidence.map((e, i) => (
                <li key={i}>
                  <strong>{e.field}</strong> — {e.statement}{" "}
                  <code>{e.evidenceClass}</code>
                </li>
              ))}
            </ul>
          )}

          <h3>Missing load-bearing fields</h3>
          <ul>
            {report.sourcingGate.missing.map((m) => (
              <li key={m.field}>{m.label}</li>
            ))}
          </ul>

          <h3>Neutral pull-list</h3>
          <ol>
            {(report.pullList ?? []).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      <h2>Report (markdown)</h2>
      <textarea className="prompt" readOnly rows={18} value={md} />
    </section>
  );
}
