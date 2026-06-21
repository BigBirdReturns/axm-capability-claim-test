import type {
  Ledger,
  Report,
  Verdict,
} from "../types/audit";
import { runObjectGate } from "./runObjectGate";
import { runSourcingGate } from "./runSourcingGate";
import { runSeams } from "./runSeams";
import { runContaminationBucket, BUCKET_LABELS } from "./runContaminationBucket";
import { generateNeutralPrompt } from "./generateNeutralPrompt";

const VERDICT_LABELS: Record<Verdict["state"], string> = {
  A_capability_with_proof: "A — capability with proof",
  B_ahead_of_proof: "B — ahead of proof",
  C_costume_or_proof_substitution: "C — costume / proof substitution",
  unclassifiable: "Unclassifiable",
  not_supplied: "Analysis not supplied",
  not_applicable: "Not applicable",
};

// Assemble the full Report object. The sourcing gate decides the shape:
// below threshold => pull-list only; at/above => seams, contamination, verdict.
export function buildReport(ledger: Ledger): Report {
  const objectGate = runObjectGate(ledger);
  const sourcingGate = runSourcingGate(ledger);

  const knownEvidence = ledger.claims
    .filter((c) => c.evidenceClass !== "open" && c.sourceIds.length > 0)
    .map((c) => ({
      field: c.field,
      statement: c.statement,
      evidenceClass: c.evidenceClass,
    }));

  const report: Report = {
    generatedAt: new Date().toISOString(),
    target: ledger.targetName,
    objectGate,
    sourcingGate,
    knownEvidence,
    ledger,
  };

  if (!sourcingGate.passed) {
    // Insufficient ledger: return only object type, route, known evidence,
    // missing load-bearing fields, and a copyable neutral pull-list.
    report.pullList = buildPullList(ledger);
    return report;
  }

  report.seams = runSeams(ledger);
  report.contamination = runContaminationBucket(ledger);
  report.verdict = buildVerdict(ledger);
  return report;
}

function buildVerdict(ledger: Ledger): Verdict {
  const v = ledger.verdictNotes;
  // No verdictNotes at all => the analysis layer was never run (not_supplied).
  // verdictNotes present but no state => the author engaged but left it open
  // (unclassifiable). These are different facts and get different tokens.
  const state: Verdict["state"] = v ? (v.state ?? "unclassifiable") : "not_supplied";
  return {
    state,
    loop: v?.loop ?? "open",
    rationale:
      v?.rationale ??
      "Verdict not supplied by the audit run. Sourcing threshold met; complete the analysis layer to classify.",
    largestGap: v?.largestGap ?? "Not quantified.",
    tenseOfProof: v?.tenseOfProof ?? "Not stated.",
    whatWouldClearIt:
      v?.whatWouldClearIt ??
      "State the falsification line: name the sourced fact that would move this to A.",
    rootsBeliefSupplier: v?.rootsBeliefSupplier ?? "Not traced.",
    rootsValueRetainer: v?.rootsValueRetainer ?? "Not traced.",
    nextPulls: v?.nextPulls ?? [],
  };
}

// Neutral pull-list: the missing load-bearing fields, expressed as mechanical,
// object-scoped retrieval tasks. No verdict language.
export function buildPullList(ledger: Ledger): string[] {
  const sourcingGate = runSourcingGate(ledger);
  return sourcingGate.missing.map(
    (m) =>
      `Pull the public record for ${ledger.targetName}: ${m.label.toLowerCase()} — sources, dates, and evidence class.`,
  );
}

// ---- Markdown rendering ----------------------------------------------------

export function renderReportMarkdown(report: Report): string {
  const L: string[] = [];
  const og = report.objectGate;
  L.push(`# Capability Claim Test — ${report.target}`);
  L.push("");
  L.push(`> Structural assessment, not an allegation of wrongdoing.`);
  L.push("");
  L.push(`**Generated:** ${report.generatedAt}`);
  L.push("");
  L.push(`## Object gate`);
  L.push(`- **Object type:** ${og.objectLabel} (\`${og.objectType}\`)`);
  L.push(`- **Route:** ${og.routeLabel} (\`${og.route}\`)`);
  L.push(`- **What you are testing:** ${og.whatYouAreTesting}`);
  L.push("");

  const sg = report.sourcingGate;
  L.push(`## Sourcing gate`);
  L.push(
    `- **Status:** ${sg.passed ? "PASS" : "INSUFFICIENT"} — ${sg.sourcedCount}/${sg.required} load-bearing fields sourced.`,
  );
  if (sg.missing.length > 0) {
    L.push(`- **Missing load-bearing fields:**`);
    sg.missing.forEach((m) => L.push(`  - ${m.label}`));
  }
  L.push("");

  L.push(`## Known evidence`);
  if (report.knownEvidence.length === 0) {
    L.push(`- None sourced yet.`);
  } else {
    report.knownEvidence.forEach((e) =>
      L.push(`- **${e.field}** — ${e.statement} _(${e.evidenceClass})_`),
    );
  }
  L.push("");

  if (!sg.passed) {
    L.push(`## Neutral pull-list`);
    L.push(`_Verdict blocked: fewer than ${sg.required} load-bearing fields sourced._`);
    L.push("");
    (report.pullList ?? []).forEach((p, i) => L.push(`${i + 1}. ${p}`));
    L.push("");
    L.push(`---`);
    L.push(`_The page does not know the truth. It enforces the method._`);
    return L.join("\n");
  }

  // Seams
  L.push(`## Seams`);
  (report.seams ?? []).forEach((s) => {
    L.push(`- **${s.question}**`);
    L.push(`  - State: \`${s.state}\``);
    L.push(`  - ${s.reason}`);
  });
  L.push("");

  // Contamination
  const c = report.contamination!;
  L.push(`## Capital contamination`);
  L.push(`- **Bucket:** ${BUCKET_LABELS[c.bucket]} (\`${c.bucket}\`)`);
  L.push(`- **Components (source-backed reasons, never a bare number):**`);
  c.components.forEach((comp) => {
    L.push(
      `  - **${comp.label}** — ${comp.present ? "present" : "not source-backed"}: ${comp.reason}`,
    );
  });
  L.push("");

  // Verdict
  const v = report.verdict!;
  L.push(`## Verdict`);
  L.push(`- **Operating proof:** ${VERDICT_LABELS[v.state]} — loop ${v.loop}`);
  L.push(`- **Rationale:** ${v.rationale}`);
  L.push(`- **Largest gap:** ${v.largestGap}`);
  L.push(`- **Tense of proof:** ${v.tenseOfProof}`);
  L.push(`- **What would clear it:** ${v.whatWouldClearIt}`);
  L.push(`- **Roots — who supplies belief:** ${v.rootsBeliefSupplier}`);
  L.push(`- **Roots — who retains value:** ${v.rootsValueRetainer}`);
  if (v.nextPulls.length > 0) {
    L.push(`- **Next pulls:**`);
    v.nextPulls.forEach((p) => L.push(`  - ${p}`));
  }
  L.push("");
  L.push(`---`);
  L.push(`_Output is a structural assessment, not an allegation of wrongdoing._`);
  return L.join("\n");
}

export { generateNeutralPrompt };
