import type { Ledger, ObjectType, Report } from "../../types/audit";

// Adapter surface. The public demo NEVER calls these — GitHub Pages cannot
// safely hold secret API keys. A self-deployer wires a provider (OpenAI,
// Anthropic, Ollama, Perplexity, GovCloud, ...) that fills the SAME ledger
// schema. The schema is the mating surface.

export interface BuildLedgerInput {
  objectType: ObjectType;
  targetName: string;
  rawContext?: string;
  retrievalPrompt: string;
  schema: object;
}

export interface ReportReview {
  // Flags raised by a model review pass over a draft report.
  flags: string[];
  // Nodes the reviewer believes were dropped (deference trap guard).
  droppedNodes: string[];
  // Intent claims unsupported by the ledger (innuendo trap guard).
  unsupportedIntent: string[];
}

export interface ReviewReportInput {
  ledger: Ledger;
  draftReport: Report;
}

export interface ClaimAuditProvider {
  name: string;

  buildLedger(input: BuildLedgerInput): Promise<Ledger>;

  reviewReport?(input: ReviewReportInput): Promise<ReportReview>;
}
