import type { SourcingGateResult } from "../types/audit";

export function SourcingGatePanel({ result }: { result: SourcingGateResult }) {
  return (
    <section className="panel">
      <h2>Sourcing gate</h2>
      <p className="muted">
        No verdict below {result.required} sourced load-bearing fields. The stop
        rule is enforced in code.
      </p>
      <p className={result.passed ? "status pass" : "status block"}>
        {result.passed ? "PASS" : "INSUFFICIENT"} — {result.sourcedCount}/
        {result.required} sourced
      </p>
      <table className="grid">
        <thead>
          <tr>
            <th>Load-bearing field</th>
            <th>Sourced</th>
            <th>Evidence class</th>
          </tr>
        </thead>
        <tbody>
          {result.fields.map((f) => (
            <tr key={f.field} className={f.sourced ? "" : "row-missing"}>
              <td>{f.label}</td>
              <td>{f.sourced ? "✓" : "—"}</td>
              <td>{f.evidenceClass ? <code>{f.evidenceClass}</code> : "open"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
