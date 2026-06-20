import { useMemo, useState } from "react";
import type { Ledger } from "../types/audit";
import { generateNeutralPrompt, sanitizeLoadedRequest } from "../lib/generateNeutralPrompt";

// LLM-assisted mode (retrieval layer). Generates a neutral, object-scoped
// retrieval prompt and demonstrates loaded-request sanitization.
export function NeutralPromptPanel({ ledger }: { ledger: Ledger }) {
  const prompt = useMemo(() => generateNeutralPrompt(ledger), [ledger]);
  const [loaded, setLoaded] = useState("find the shady VC network behind Company X");
  const sanitized = useMemo(() => sanitizeLoadedRequest(loaded), [loaded]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="panel">
      <h2>Neutral retrieval prompt</h2>
      <p className="muted">
        Retrieval and analysis are separate layers. Copy this into the model of
        your choice, then paste the ledger JSON back below.
      </p>
      <textarea className="prompt" readOnly value={prompt} rows={14} />
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy prompt"}
      </button>

      <h3>Loaded-request sanitization</h3>
      <p className="muted">
        A fused, accusatory request is rewritten into neutral, object-scoped
        retrieval — never refused, moralized, or stripped of named public nodes.
      </p>
      <label className="field">
        <span>Loaded input</span>
        <input
          type="text"
          value={loaded}
          onChange={(e) => setLoaded(e.target.value)}
        />
      </label>
      <div className="sanitized">
        <strong>Neutral rewrite →</strong> {sanitized.neutral}
      </div>
    </section>
  );
}
