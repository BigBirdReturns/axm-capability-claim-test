import type { Ledger } from "../../types/audit";
import type {
  BuildLedgerInput,
  ClaimAuditProvider,
  ReportReview,
  ReviewReportInput,
} from "./ProviderAdapter";

// MockAdapter makes NO network calls. It demonstrates the adapter contract by
// returning an empty, schema-valid ledger scaffold for the requested object.
// It exists so the type surface compiles and so self-deployers have a template.
export class MockAdapter implements ClaimAuditProvider {
  name = "mock";

  async buildLedger(input: BuildLedgerInput): Promise<Ledger> {
    return {
      schemaVersion: 1,
      objectType: input.objectType,
      targetName: input.targetName,
      sources: [],
      claims: [],
      context:
        input.rawContext ??
        "Mock adapter: no retrieval performed. Paste a real ledger or wire a provider.",
    };
  }

  async reviewReport(_input: ReviewReportInput): Promise<ReportReview> {
    return {
      flags: [],
      droppedNodes: [],
      unsupportedIntent: [],
    };
  }
}
