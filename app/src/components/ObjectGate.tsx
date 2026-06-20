import type { ObjectGateResult } from "../types/audit";

export function ObjectGate({ result }: { result: ObjectGateResult }) {
  return (
    <section className="panel">
      <h2>Object gate</h2>
      <p className="muted">Run first, always. Wrong object, wrong test.</p>
      <dl className="kv">
        <dt>Object type</dt>
        <dd>
          {result.objectLabel} <code>{result.objectType}</code>
        </dd>
        <dt>Route</dt>
        <dd>
          {result.routeLabel} <code>{result.route}</code>
        </dd>
        <dt>What you are testing</dt>
        <dd>{result.whatYouAreTesting}</dd>
      </dl>
    </section>
  );
}
