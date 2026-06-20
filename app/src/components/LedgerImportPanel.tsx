import { useState } from "react";
import type { Ledger } from "../types/audit";
import { validateLedger } from "../lib/validateLedger";

// Paste ledger JSON (from an LLM or an adapter) and validate against the
// schema before it enters the method.
export function LedgerImportPanel({
  onImport,
}: {
  onImport: (ledger: Ledger) => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState(false);

  function handleValidate() {
    const result = validateLedger(text);
    setErrors(result.errors);
    setOk(result.ok);
    if (result.ok && result.ledger) {
      onImport(result.ledger);
    }
  }

  return (
    <section className="panel">
      <h2>Import ledger JSON</h2>
      <p className="muted">
        The schema is the mating surface. Paste JSON matching the ledger schema;
        it is validated locally, no network.
      </p>
      <textarea
        className="prompt"
        rows={10}
        value={text}
        placeholder='{ "schemaVersion": 1, "objectType": "product_company", "targetName": "...", "sources": [], "claims": [] }'
        onChange={(e) => setText(e.target.value)}
      />
      <button type="button" onClick={handleValidate}>
        Validate &amp; import
      </button>
      {ok && <p className="status pass">Valid — ledger imported.</p>}
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
