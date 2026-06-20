import { useMemo, useState } from "react";
import type { Ledger } from "./types/audit";
import { EXAMPLES } from "./data/exampleLedgers";
import { buildReport } from "./lib/renderReport";
import { ObjectGate } from "./components/ObjectGate";
import { HelpPanel } from "./components/HelpPanel";
import { SourceLedgerForm } from "./components/SourceLedgerForm";
import { SourcingGatePanel } from "./components/SourcingGatePanel";
import { NeutralPromptPanel } from "./components/NeutralPromptPanel";
import { LedgerImportPanel } from "./components/LedgerImportPanel";
import { ContaminationPanel } from "./components/ContaminationPanel";
import { VerdictPanel } from "./components/VerdictPanel";
import { ReportPreview } from "./components/ReportPreview";
import { ExportPanel } from "./components/ExportPanel";

function emptyLedger(): Ledger {
  return {
    schemaVersion: 1,
    objectType: "product_company",
    targetName: "",
    sources: [],
    claims: [],
  };
}

type Mode = "manual" | "llm" | "import";

export default function App() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [mode, setMode] = useState<Mode>("manual");
  // Help opens by default so a first-time user is never stranded; the "?"
  // toggle keeps it reachable mid-audit.
  const [showHelp, setShowHelp] = useState(true);

  const report = useMemo(() => (ledger ? buildReport(ledger) : null), [ledger]);

  function startNew() {
    setLedger(emptyLedger());
    setMode("manual");
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-row">
          <h1>Capability Claim Test</h1>
          <button
            type="button"
            className="help-toggle"
            aria-label="How to use this"
            onClick={() => setShowHelp((v) => !v)}
          >
            {showHelp ? "Hide help" : "? How to use"}
          </button>
        </div>
        <p className="tagline">
          Bring your own sources. Bring your own model. The method enforces the
          ledger.
        </p>
        <p className="muted small">
          A static instrument, not an AI app. The page does not know the truth.
          It enforces the method.
        </p>
      </header>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      <section className="launch">
        <button type="button" className="primary" onClick={startNew}>
          Start New Audit
        </button>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.key}
            type="button"
            title={ex.blurb}
            onClick={() => {
              setLedger(ex.ledger);
              setMode("manual");
            }}
          >
            {ex.buttonLabel}
          </button>
        ))}
      </section>

      {!ledger && (
        <section className="panel intro">
          <h2>New here? Start with an example.</h2>
          <p>
            Click <strong>Load Example: Circular / Unproven</strong> above to see
            the whole tool in one shot — a verdict, a contamination bucket, and
            sourced reasons. Then try <strong>Start New Audit</strong> to run your
            own.
          </p>
          <p className="muted">
            The walkthrough up top (<strong>? How to use</strong>) explains every
            step. The tool can acquit, classify, or refuse to verdict — the
            examples show each.
          </p>
        </section>
      )}

      {ledger && report && (
        <main className="workbench">
          <div className="modes">
            <button
              className={mode === "manual" ? "active" : ""}
              onClick={() => setMode("manual")}
            >
              Manual
            </button>
            <button
              className={mode === "llm" ? "active" : ""}
              onClick={() => setMode("llm")}
            >
              LLM-assisted
            </button>
            <button
              className={mode === "import" ? "active" : ""}
              onClick={() => setMode("import")}
            >
              Import JSON
            </button>
          </div>

          <ObjectGate result={report.objectGate} />

          {mode === "manual" && (
            <SourceLedgerForm ledger={ledger} onChange={setLedger} />
          )}
          {mode === "llm" && <NeutralPromptPanel ledger={ledger} />}
          {mode === "import" && <LedgerImportPanel onImport={setLedger} />}

          <SourcingGatePanel result={report.sourcingGate} />

          {/* Verdict + contamination mount only when the sourcing gate passes;
              below threshold they never render. ReportPreview handles both the
              blocked (pull-list) and passed states, so it renders once here. */}
          {report.sourcingGate.passed && (
            <>
              <VerdictPanel report={report} />
              {report.contamination && (
                <ContaminationPanel result={report.contamination} ledger={ledger} />
              )}
            </>
          )}

          <ReportPreview report={report} />

          <ExportPanel report={report} />
        </main>
      )}

      <footer className="foot">
        <p className="muted small">
          Output is a structural assessment, not an allegation of wrongdoing.
          Every verdict carries its evidence classification and its
          falsification line, or it is not finished.
        </p>
        <p className="muted small">build {__BUILD_SHA__}</p>
      </footer>
    </div>
  );
}
