// In-app help. Reachable any time via the "?" toggle in the masthead, and shown
// by default on the landing screen so a first-time user is never stranded.
export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className="panel help">
      <div className="help-head">
        <h2>How to use this</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="muted">
        This tool audits a claim — does a capability actually work, or is a
        fund's claimed judgment really theirs? It does not decide the truth; it
        enforces a method and shows its work. Output is a structural assessment,
        not an allegation of wrongdoing.
      </p>

      <h3>Fastest start: load an example</h3>
      <p>
        Click one of the example buttons. It's the quickest way to see what the
        tool does:
      </p>
      <ul>
        <li>
          <strong>Cleared Capability</strong> — real proof. The tool acquits it:
          verdict <em>A</em>, contamination <em>clean</em>.
        </li>
        <li>
          <strong>Circular / Unproven</strong> — legitimacy manufactured by its
          own backers. The tool classifies it: verdict <em>C</em>, contamination{" "}
          <em>circular</em>, every reason sourced.
        </li>
        <li>
          <strong>Insufficient Ledger</strong> — too little is sourced, so the
          tool refuses to verdict and returns a <em>pull-list</em> of what to go
          find.
        </li>
        <li>
          <strong>Capital Allocator</strong> — a fund, routed through{" "}
          <em>attribution</em> questions instead of product ones.
        </li>
      </ul>

      <h3>Running your own audit</h3>
      <ol>
        <li>
          Click <strong>Start New Audit</strong> and pick an{" "}
          <strong>object type</strong>. This fixes the route — you can't push a
          fund through the company instrument.
        </li>
        <li>
          Fill the <strong>load-bearing fields</strong>. Each is a claim with a{" "}
          <strong>source</strong> and an <strong>evidence class</strong>{" "}
          (confirmed / reported / derived / judgment / open). A field only counts
          when it cites a source and isn't <em>open</em>.
        </li>
        <li>
          The <strong>sourcing gate</strong> unlocks the verdict once{" "}
          <strong>three</strong> fields are sourced. Below that you get the
          pull-list instead — by design.
        </li>
        <li>
          Read the <strong>contamination bucket</strong> (with sourced reasons)
          and the <strong>verdict</strong> (with its "what would clear it" line).
        </li>
        <li>
          <strong>Export</strong> the report as Markdown, JSON, or CSV — all
          generated locally in your browser.
        </li>
      </ol>

      <h3>The three modes</h3>
      <ul>
        <li>
          <strong>Manual</strong> — type claims and sources into the form.
        </li>
        <li>
          <strong>LLM-assisted</strong> — copy the neutral retrieval prompt into
          any model, then paste the ledger JSON back.
        </li>
        <li>
          <strong>Import JSON</strong> — paste a ready-made ledger (from a model
          or the bundled MCP server) and validate it.
        </li>
      </ul>

      <p className="muted small">
        Nothing leaves your browser. No accounts, no keys, no network.
      </p>
    </section>
  );
}
