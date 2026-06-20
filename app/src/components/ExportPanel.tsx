import type { Report } from "../types/audit";
import {
  exportReportJson,
  exportReportMarkdown,
  exportSourceLedgerCsv,
} from "../lib/exportFiles";

// All exports run locally in the browser. No backend, no network.
export function ExportPanel({ report }: { report: Report }) {
  return (
    <section className="panel">
      <h2>Export</h2>
      <p className="muted">Generated locally in your browser.</p>
      <div className="export-buttons">
        <button type="button" onClick={() => exportReportMarkdown(report)}>
          report.md
        </button>
        <button type="button" onClick={() => exportReportJson(report)}>
          report.json
        </button>
        <button type="button" onClick={() => exportSourceLedgerCsv(report.ledger)}>
          source-ledger.csv
        </button>
      </div>
    </section>
  );
}
