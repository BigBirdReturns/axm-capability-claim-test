import { useMemo, useState } from "react";
import type { Ledger } from "./types/audit";
import { EXAMPLES } from "./data/exampleLedgers";
import { buildReport } from "./lib/renderReport";
import { ObjectGate } from "./components/ObjectGate";
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

  const report = useMemo(() => (ledger ? buildReport(ledger) : null), [ledger]);

  function startNew() {
    setLedger(emptyLedger());
    setMode("manual");
  }

  return (
    <div className="app">
      <header className="masthead">
        <h1>Capability Claim Test</h1>
        <p className="tagline">
          Bring your own sources. Bring your own model. The method enforces the
          ledger.
        </p>
        <p className="muted small">
          A static instrument, not an AI app. The page does not know the truth.
          It enforces the method.
        </p>
      </header>

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
          <h2>Four-layer workflow</h2>
          <ol>
            <li>
              <strong>Retrieval.</strong> Neutral, mechanical, object-scoped.
            </li>
            <li>
              <strong>Ledger.</strong> Claim / source / evidence class /
              confidence.
            </li>
            <li>
              <strong>Analysis.</strong> Object gate, sourcing gate,
              contamination bucket, verdict.
            </li>
            <li>
              <strong>Publication.</strong> Remove unsupported intent, preserve
              sourced structure.
            </li>
          </ol>
          <p className="muted">
            Load an example to see the instrument acquit, classify, or refuse to
            verdict.
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

          {report.sourcingGate.passed ? (
            <>
              <VerdictPanel report={report} />
              {report.contamination && (
                <ContaminationPanel
                  result={report.contamination}
                  ledger={ledger}
                />
              )}
            </>
          ) : (
            <ReportPreview report={report} />
          )}

          {report.sourcingGate.passed && <ReportPreview report={report} />}

          <ExportPanel report={report} />
        </main>
      )}

      <footer className="foot">
        <p className="muted small">
          Internal method: Gun-or-Vehicle Test. Output is a structural
          assessment, not an allegation of wrongdoing. Every verdict carries its
          evidence classification and its falsification line, or it is not
          finished.
        </p>
      </footer>
    </div>
  );
}
