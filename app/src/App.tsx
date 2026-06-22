import { useMemo, useRef, useState } from "react";
import type {
  Claim,
  EvidenceClass,
  Ledger,
  ObjectType,
  Report,
  VerdictState,
} from "./types/audit";
import { OBJECT_ROUTES, OBJECT_TYPE_OPTIONS } from "./data/objectRoutes";
import { EVIDENCE_CLASSES, fieldsForSet } from "./data/loadBearingFields";
import { EXAMPLES } from "./data/exampleLedgers";
import { buildReport, renderReportMarkdown } from "./lib/renderReport";
import { BUCKET_LABELS } from "./lib/runContaminationBucket";
import { generateNeutralPrompt } from "./lib/generateNeutralPrompt";
import { validateLedger } from "./lib/validateLedger";
import {
  exportReportJson,
  exportReportMarkdown,
  exportSourceLedgerCsv,
} from "./lib/exportFiles";

const VERDICT_LABELS: Record<VerdictState, string> = {
  A_capability_with_proof: "A — capability with proof",
  B_ahead_of_proof: "B — ahead of proof",
  C_costume_or_proof_substitution: "C — costume / proof substitution",
  unclassifiable: "Unclassifiable",
  not_supplied: "Analysis not supplied",
  not_applicable: "Not applicable",
};

function emptyLedger(): Ledger {
  return {
    schemaVersion: 1,
    objectType: "product_company",
    targetName: "",
    context: "",
    sources: [],
    claims: [],
  };
}

function scrollToId(id: string) {
  const n = document.getElementById(id);
  if (n) window.scrollTo({ top: n.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
}

export default function App() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const report = useMemo(() => (ledger ? buildReport(ledger) : null), [ledger]);

  function flash(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }

  return (
    <div className="shell">
      <Rail report={report} loaded={!!ledger} />
      <main className="main">
        <div className="topbar">
          <div className="wrap">
            <div className="crumbs">
              {report ? (
                <>
                  <span>Audit</span>
                  <span className="sep">/</span>
                  <b>{ledger!.targetName || "Untitled"}</b>
                  <span className="sep">/</span>
                  <span>{report.objectGate.objectLabel}</span>
                </>
              ) : (
                <span>No audit loaded</span>
              )}
            </div>
            <div className="actions">
              <button className="btn ghost sm" onClick={() => setLedger(null)}>
                Examples
              </button>
              <button className="btn sm" onClick={() => setLedger(emptyLedger())}>
                ＋ New audit
              </button>
            </div>
          </div>
        </div>

        <div className="wrap">
          {!ledger || !report ? (
            <Launch onLoad={setLedger} />
          ) : (
            <Workbench
              ledger={ledger}
              report={report}
              setLedger={setLedger}
              flash={flash}
            />
          )}
        </div>
      </main>

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Rail

function Rail({ report, loaded }: { report: Report | null; loaded: boolean }) {
  const sg = report?.sourcingGate ?? { sourcedCount: 0, passed: false, required: 3, fields: [] as unknown[] };
  const passed = sg.passed;
  const count = sg.sourcedCount;

  const steps = [
    { t: "Object", d: report ? report.objectGate.objectLabel : "Pick what you're testing", anchor: "stage-object" },
    { t: "Ledger", d: report ? `${count} of ${report.sourcingGate.fields.length} fields sourced` : "Claims, sources, evidence class", anchor: "stage-ledger" },
    { t: "Analysis", d: passed ? "Contamination + verdict" : "Locked until 3 sourced", anchor: "stage-analysis" },
    { t: "Report", d: "Export the audit", anchor: "stage-report" },
  ];
  const stt = !loaded
    ? (["locked", "locked", "locked", "locked"] as const)
    : !passed
      ? (["done", "active", "locked", "active"] as const)
      : (["done", "done", "active", "active"] as const);

  return (
    <aside className="rail">
      <div className="brand">
        <span className="mark"><span className="dot" />Capability Claim Test</span>
        <h1>Claim-audit workbench</h1>
        <span className="sub">The page does not know the truth. It enforces the method.</span>
      </div>

      {report && (
        <div className="target">
          <div className="micro">Auditing</div>
          <div className="name">{report.target || "Untitled object"}</div>
          <div className="route">{report.objectGate.routeLabel}</div>
        </div>
      )}

      <nav className="spine">
        <div className="micro lbl">The four-layer method</div>
        {steps.map((s, i) => (
          <button
            key={s.t}
            className={`step ${stt[i]}`}
            onClick={() => loaded && scrollToId(s.anchor)}
            style={{ cursor: loaded ? "pointer" : "default" }}
          >
            <div className="ord">{stt[i] === "done" ? "✓" : i + 1}</div>
            <div className="body">
              <div className="t">{s.t}</div>
              <div className="d">{s.d}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className={`gate ${passed ? "is-open" : "is-locked"}`}>
        <div className="ghead">
          <span className="gtitle">Sourcing gate</span>
          <span className="gcount"><b>{count}</b>/3 sourced</span>
        </div>
        <div className="pips">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`pip${i < count ? " on" : ""}`} />
          ))}
          {count > 3 && <div className="pip over" title={`+${count - 3} beyond threshold`} />}
        </div>
        <div className="glabel">
          <span className="ic">{passed ? "🔓" : "🔒"}</span>
          <span>{passed ? "Verdict unlocked" : "Verdict locked"}</span>
        </div>
        <div className="ghint">
          {passed
            ? "Threshold met. The analysis layer renders below."
            : loaded
              ? `${3 - count} more sourced field${3 - count === 1 ? "" : "s"} needed. Below threshold the output is a pull-list, by design.`
              : "Three load-bearing fields must be sourced before a verdict can render."}
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- Launch

function Launch({ onLoad }: { onLoad: (l: Ledger) => void }) {
  return (
    <div className="launch">
      <div className="micro kicker">Static instrument · no keys · nothing leaves your browser</div>
      <h2>Turn public field data into a sourced capability verdict.</h2>
      <p className="lede">
        Bring your own sources, bring your own model — the method enforces the ledger. The
        instrument can <b style={{ color: "var(--ink-2)" }}>acquit</b>,{" "}
        <b style={{ color: "var(--ink-2)" }}>classify</b>, or{" "}
        <b style={{ color: "var(--ink-2)" }}>refuse to verdict</b>. It never hands back a
        number without its reasons.
      </p>
      <p className="note">
        New here? Load an example — it's the whole tool in one shot: a route, a sourcing gate,
        a contamination bucket, and a verdict with its falsification line.
      </p>

      <div className="divider">
        <span className="line" /><span className="micro">Worked examples</span><span className="line" />
      </div>

      <div className="ex-grid">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.key}
            className={`ex-card ${ex.key === "cleared" ? "cleared" : ex.key === "circular" ? "circular" : ""}`}
            onClick={() => onLoad(structuredClone(ex.ledger))}
          >
            <div className="ex-top">
              <span className="ex-name">{ex.name}</span>
              <span className="ex-beh">{ex.behavior}</span>
            </div>
            <div className="ex-blurb">{ex.blurb}</div>
            <div className="ex-tag">{ex.verdictTag}<span className="arr">→</span></div>
          </button>
        ))}
      </div>

      <button className="start-blank" onClick={() => onLoad(emptyLedger())}>
        <b>Start a blank audit →</b>  pick an object type and build the ledger yourself
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Workbench

interface WBProps {
  ledger: Ledger;
  report: Report;
  setLedger: (l: Ledger) => void;
  flash: (m: string) => void;
}

function Workbench({ ledger, report, setLedger, flash }: WBProps) {
  return (
    <>
      <ObjectStage ledger={ledger} report={report} setLedger={setLedger} />
      <LedgerStage ledger={ledger} report={report} setLedger={setLedger} flash={flash} />
      <AnalysisStage report={report} flash={flash} />
      <ReportStage report={report} ledger={ledger} flash={flash} />
      <div className="disclaimer">
        <p>
          Output is a structural assessment, not an allegation of wrongdoing. Every verdict
          carries its evidence classification and its falsification line, or it is not
          finished. Examples are synthetic and illustrative.
        </p>
      </div>
    </>
  );
}

function StageHead({ num, title, hint }: { num: string; title: string; hint?: string }) {
  return (
    <div className="stage-head">
      <span className="num">{num}</span>
      <h3>{title}</h3>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

// ---- 01 Object gate

function ObjectStage({ ledger, report, setLedger }: { ledger: Ledger; report: Report; setLedger: (l: Ledger) => void }) {
  const og = report.objectGate;
  const fieldSet = OBJECT_ROUTES[ledger.objectType].fieldSet;
  return (
    <section className="stage" id="stage-object">
      <StageHead num="01" title="Object gate" hint="Wrong object, wrong test" />
      <div className="panel">
        <div className="field-control">
          <label>Object type — fixes the route</label>
          <select
            value={ledger.objectType}
            onChange={(e) => setLedger({ ...ledger, objectType: e.target.value as ObjectType })}
          >
            {OBJECT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{OBJECT_ROUTES[t].objectLabel}</option>
            ))}
          </select>
        </div>
        <div className="field-control">
          <label>Target name</label>
          <input
            type="text"
            value={ledger.targetName}
            placeholder="Public object being audited"
            onChange={(e) => setLedger({ ...ledger, targetName: e.target.value })}
          />
        </div>
        <div style={{ margin: "16px 0 16px" }}>
          <span className="route-badge">▷ {og.routeLabel}</span>
        </div>
        <dl className="route-grid">
          <dt>Object type</dt>
          <dd>{og.objectLabel} <span className="code">{og.objectType}</span></dd>
          <dt>What you're testing</dt>
          <dd>{og.whatYouAreTesting}</dd>
          <dt>Field set</dt>
          <dd><span className="code">{fieldSet}</span> load-bearing fields</dd>
        </dl>
      </div>
    </section>
  );
}

// ---- 02 Ledger

function ensureClaim(ledger: Ledger, field: string): { ledger: Ledger; claim: Claim } {
  let claim = ledger.claims.find((c) => c.field === field);
  let claims = ledger.claims;
  if (!claim) {
    claim = { id: `claim_${field}`, field, statement: "", evidenceClass: "open", sourceIds: [] };
    claims = [...ledger.claims, claim];
  }
  return { ledger: { ...ledger, claims }, claim };
}

function LedgerStage({ ledger, report, setLedger, flash }: WBProps) {
  const fieldSet = OBJECT_ROUTES[ledger.objectType].fieldSet;
  const fields = fieldsForSet(fieldSet);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  function setEvidence(field: string, ec: EvidenceClass) {
    const { ledger: l } = ensureClaim(ledger, field);
    setLedger({ ...l, claims: l.claims.map((c) => (c.field === field ? { ...c, evidenceClass: ec } : c)) });
  }

  function setStatement(field: string, statement: string) {
    const { ledger: l } = ensureClaim(ledger, field);
    setLedger({ ...l, claims: l.claims.map((c) => (c.field === field ? { ...c, statement } : c)) });
  }

  // Cite/uncite adds (or removes) a real source so the gate — which resolves
  // source ids — actually counts it. A citation without a source is not sourced.
  function toggleCite(field: string) {
    const { ledger: l, claim } = ensureClaim(ledger, field);
    if (claim.sourceIds.length > 0) {
      setLedger({
        ...l,
        claims: l.claims.map((c) => (c.field === field ? { ...c, sourceIds: [] } : c)),
      });
      return;
    }
    const id = `u${l.sources.length + 1}`;
    setLedger({
      ...l,
      sources: [...l.sources, { id, title: "User-added citation" }],
      claims: l.claims.map((c) =>
        c.field === field
          ? { ...c, sourceIds: [id], evidenceClass: c.evidenceClass === "open" ? "reported" : c.evidenceClass }
          : c,
      ),
    });
  }

  function runImport() {
    const result = validateLedger(importText);
    setImportErrors(result.errors);
    if (result.ok && result.ledger) {
      setLedger(result.ledger);
      setImportText("");
      flash("Ledger imported");
    }
  }

  return (
    <section className="stage" id="stage-ledger">
      <StageHead num="02" title="Source ledger" hint="Toggle evidence & citation — watch the gate" />
      <div className="panel">
        <div className="ledger-head">
          <div>
            <div className="micro" style={{ marginBottom: 3 }}>Load-bearing fields</div>
            <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
              A field counts only when it cites a source <em style={{ color: "var(--muted)", fontStyle: "normal" }}>and</em> isn't{" "}
              <code style={{ fontFamily: "var(--mono)", color: "var(--block)" }}>open</code> or{" "}
              <code style={{ fontFamily: "var(--mono)", color: "var(--block)" }}>judgment</code>.
            </div>
          </div>
          <div className="lh-meta"><b>{report.sourcingGate.sourcedCount}</b> sourced</div>
        </div>

        {fields.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Claim-only route: assess tense, source class, baseline, beneficiary — no
            load-bearing field set.
          </p>
        ) : (
          <div className="fields">
            {fields.map((f) => {
              const claim = ledger.claims.find((c) => c.field === f.field);
              const status = report.sourcingGate.fields.find((s) => s.field === f.field);
              const sourced = status?.sourced ?? false;
              const cls = claim?.evidenceClass ?? "open";
              const srcIds = claim?.sourceIds ?? [];
              const canCite = !!(claim && claim.statement);
              return (
                <div key={f.field} className={`frow${sourced ? " sourced" : ""}`}>
                  <div className="f-label">{f.label}</div>
                  <div className="f-state">
                    <span className={`state-badge ${sourced ? "yes" : "no"}`}>
                      {sourced ? "● sourced" : "○ unsourced"}
                    </span>
                    <div className="ev-seg">
                      {EVIDENCE_CLASSES.map((ec) => (
                        <button
                          key={ec}
                          className={`${ec === cls ? "on" : ""} ${ec === "open" ? "open" : ""}`}
                          onClick={() => setEvidence(f.field, ec)}
                        >
                          {ec}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    className="stmt-input f-stmt"
                    value={claim?.statement ?? ""}
                    placeholder="Enter the claim for this field…"
                    onChange={(e) => setStatement(f.field, e.target.value)}
                  />
                  <div className="f-srcs">
                    {srcIds.length > 0
                      ? srcIds.map((id) => <span key={id} className="src-chip">{id}</span>)
                      : <span className="src-chip none">uncited</span>}
                    {canCite && (
                      <button className="btn ghost sm" style={{ padding: "2px 8px", fontSize: 10.5 }} onClick={() => toggleCite(f.field)}>
                        {srcIds.length ? "✕ uncite" : "+ cite source"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details className="byo">
          <summary>Bring your own model — neutral retrieval prompt &amp; ledger import</summary>
          <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 6px" }}>
            Copy this neutral, object-scoped prompt into any model, then paste the returned
            ledger JSON below and import. Retrieval stays separate from the verdict.
          </p>
          <textarea readOnly value={generateNeutralPrompt(ledger)} style={{ minHeight: 90 }} />
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(generateNeutralPrompt(ledger)); flash("Prompt copied"); }}>
            ⧉ Copy prompt
          </button>
          <textarea
            value={importText}
            placeholder='Paste ledger JSON here, then Import…'
            onChange={(e) => setImportText(e.target.value)}
          />
          <button className="btn sm" style={{ marginTop: 8 }} onClick={runImport}>Validate &amp; import</button>
          {importErrors.length > 0 && (
            <ul className="errors">{importErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
        </details>
      </div>
    </section>
  );
}

// ---- 03 Analysis

function AnalysisStage({ report, flash }: { report: Report; flash: (m: string) => void }) {
  const sg = report.sourcingGate;
  const passed = sg.passed;
  return (
    <section className="stage" id="stage-analysis">
      <div className={`gateline ${passed ? "open" : "locked"}`}>
        <div className="bar">
          <div className="icn">{passed ? "🔓" : "🔒"}</div>
          <div className="gl-txt">
            <div className="h">{passed ? "Sourcing gate passed — verdict unlocked" : "Sourcing gate — verdict blocked"}</div>
            <div className="s">
              {passed
                ? "Three or more load-bearing fields are sourced. Seams, contamination, and verdict render below."
                : "Fewer than three sourced fields. The only output is a neutral pull-list — by design. The page refuses to verdict."}
            </div>
          </div>
          <div className="gl-meter">{sg.sourcedCount}<span>/{sg.required}</span></div>
        </div>
      </div>

      <StageHead num="03" title={passed ? "Analysis" : "Refuse to verdict"} hint={passed ? "Contamination · verdict · seams" : "Pull-list only"} />

      {!passed ? <BlockedPanels report={report} flash={flash} /> : <AnalysisPanels report={report} />}
    </section>
  );
}

function BlockedPanels({ report, flash }: { report: Report; flash: (m: string) => void }) {
  return (
    <>
      <div className="panel">
        <div className="micro" style={{ marginBottom: 10 }}>Known evidence (sourced so far)</div>
        {report.knownEvidence.length === 0 ? (
          <p className="muted">Nothing sourced yet.</p>
        ) : (
          report.knownEvidence.map((e, i) => (
            <div key={i} className="ke-row">
              <div className="ke-f">{e.field}</div>
              <div className="ke-s">{e.statement}<span className="ev-pill">{e.evidenceClass}</span></div>
            </div>
          ))
        )}
      </div>

      <div className="panel reveal">
        <div className="micro" style={{ marginBottom: 4 }}>Neutral pull-list — what to go find</div>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 4px" }}>
          Mechanical, object-scoped retrieval tasks. No verdict language.
        </p>
        <div className="pulllist">
          {(report.pullList ?? []).map((t, i) => (
            <div key={i} className="pl-row">
              <div className="pl-n">{String(i + 1).padStart(2, "0")}</div>
              <div className="pl-t">{t}</div>
            </div>
          ))}
        </div>
        <div className="copy-row">
          <button
            className="btn sm"
            onClick={() => { navigator.clipboard?.writeText((report.pullList ?? []).map((t, i) => `${i + 1}. ${t}`).join("\n")); flash("Pull-list copied"); }}
          >
            ⧉ Copy pull-list
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            {(report.pullList ?? []).length} missing field{(report.pullList ?? []).length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </>
  );
}

function AnalysisPanels({ report }: { report: Report }) {
  const v = report.verdict!;
  const c = report.contamination!;
  const letter = "ABC".includes(v.state[0]!.toUpperCase()) ? v.state[0]!.toUpperCase() : "—";
  const [seamsOpen, setSeamsOpen] = useState(false);

  return (
    <>
      <div className="reveal">
        <div className="verdict-card">
          <div className={`verdict-top ${letter}`}>
            <div className="verdict-letter">{letter}</div>
            <div className="vt-txt">
              <div className="vt-h">{VERDICT_LABELS[v.state]}</div>
              <div className="vt-s">operating proof · loop {v.loop}</div>
            </div>
          </div>
          <div className="verdict-body">
            <div className="rationale">{v.rationale}</div>
            <div className="vfields">
              <div className="vfield"><div className="vk">Largest gap</div><div className="vv">{v.largestGap}</div></div>
              <div className="vfield"><div className="vk">Tense of proof</div><div className="vv">{v.tenseOfProof}</div></div>
              <div className="vfield"><div className="vk">Roots — who supplies belief</div><div className="vv">{v.rootsBeliefSupplier}</div></div>
              <div className="vfield"><div className="vk">Roots — who retains value</div><div className="vv">{v.rootsValueRetainer}</div></div>
              <div className="clearit"><div className="vk">▶ What would clear it (falsification line)</div><div className="vv">{v.whatWouldClearIt}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel reveal">
        <div className="bucket-row">
          <span className="micro" style={{ marginRight: 4 }}>Capital contamination</span>
          <span className={`bucket-tag bucket-${c.bucket}`}>{BUCKET_LABELS[c.bucket]}</span>
        </div>
        <p className="never-bare">A bucket with source-backed reasons — never a bare number.</p>
        <div className="comps">
          {c.components.map((comp) => (
            <div key={comp.key} className={`comp${comp.present ? " present" : ""}`}>
              <div className="c-label">{comp.label}</div>
              <div className="c-pres">{comp.present ? "● present" : "not source-backed"}</div>
              <div className="c-reason">{comp.reason}</div>
              <div className="c-srcs">
                {comp.sourceIds.length > 0
                  ? comp.sourceIds.map((id) => <span key={id} className="src-chip">{id}</span>)
                  : <span className="src-chip none">no source</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {report.seams && report.seams.length > 0 && (
        <div className="panel reveal">
          <div className="micro" style={{ marginBottom: 4 }}>Seams — the forced questions</div>
          <button className="btn ghost sm seams-toggle" onClick={() => setSeamsOpen((o) => !o)}>
            {seamsOpen ? "Hide seams ▴" : `Show ${report.seams.length} seams ▾`}
          </button>
          {seamsOpen && (
            <div style={{ marginTop: 10 }}>
              {report.seams.map((sm) => (
                <div key={sm.id} className="seam">
                  <div className="s-head">
                    <span className={`s-state s-${sm.state}`}>{sm.state.replace(/_/g, " ")}</span>
                    <span className="s-q">{sm.question.split(".")[0]}</span>
                  </div>
                  <div className="s-r">{sm.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---- 04 Report

function ReportStage({ report, ledger, flash }: { report: Report; ledger: Ledger; flash: (m: string) => void }) {
  const md = useMemo(() => renderReportMarkdown(report), [report]);
  const exports = [
    { f: "report.md", d: "Full audit, Markdown", run: () => exportReportMarkdown(report) },
    { f: "report.json", d: "Structured report", run: () => exportReportJson(report) },
    { f: "source-ledger.csv", d: "Claims & sources", run: () => exportSourceLedgerCsv(ledger) },
  ];
  return (
    <section className="stage" id="stage-report">
      <StageHead num="04" title="Publication" hint="Generated locally — nothing leaves the browser" />
      <div className="panel">
        <div className="export-grid">
          {exports.map((e) => (
            <button key={e.f} className="exp-card" onClick={() => { e.run(); flash(`${e.f} downloaded`); }}>
              <div className="ec-f">↓ {e.f}</div>
              <div className="ec-d">{e.d}</div>
            </button>
          ))}
        </div>
        <div className="preview"><pre>{md}</pre></div>
      </div>
    </section>
  );
}
