import type { Ledger } from "../types/audit";
import { validateLedger } from "../lib/validateLedger";
import clearedRaw from "../../../examples/cleared-capability/ledger.json";
import circularRaw from "../../../examples/circular-unproven/ledger.json";
import insufficientRaw from "../../../examples/insufficient-ledger/ledger.json";
import allocatorRaw from "../../../examples/capital-allocator-insufficient/ledger.json";

export type ExampleKey =
  | "cleared"
  | "circular"
  | "insufficient"
  | "allocator_insufficient";

export interface ExampleDef {
  key: ExampleKey;
  buttonLabel: string;
  name: string;
  behavior: string;
  verdictTag: string;
  blurb: string;
  ledger: Ledger;
}

// Each example is validated through the same gate as pasted JSON. If an example
// ever drifts from the schema, this throws at module load — a build-time guard.
function load(raw: unknown, name: string): Ledger {
  const result = validateLedger(raw);
  if (!result.ok || !result.ledger) {
    throw new Error(`Example "${name}" failed validation: ${result.errors.join("; ")}`);
  }
  return result.ledger;
}

export const EXAMPLES: ExampleDef[] = [
  {
    key: "cleared",
    name: "Cleared Capability",
    buttonLabel: "Load Example: Cleared Capability",
    behavior: "Acquit",
    verdictTag: "A / Clean",
    blurb: "A company with real proof. The tool acquits it.",
    ledger: load(clearedRaw, "cleared-capability"),
  },
  {
    key: "circular",
    name: "Circular / Unproven",
    buttonLabel: "Load Example: Circular / Unproven",
    behavior: "Classify",
    verdictTag: "C / Circular",
    blurb: "Legitimacy manufactured by its own backers. The tool classifies it — every reason sourced.",
    ledger: load(circularRaw, "circular-unproven"),
  },
  {
    key: "insufficient",
    name: "Insufficient Ledger",
    buttonLabel: "Load Example: Insufficient Ledger",
    behavior: "Refuse to verdict",
    verdictTag: "Pull-list only",
    blurb: "Too little is sourced. The tool refuses to verdict and hands back what to go find.",
    ledger: load(insufficientRaw, "insufficient-ledger"),
  },
  {
    key: "allocator_insufficient",
    name: "Capital Allocator",
    buttonLabel: "Load Example: Capital Allocator / Insufficient Attribution Ledger",
    behavior: "Refuse + route",
    verdictTag: "Attribution route",
    blurb: "A fund, routed through attribution questions — not product-company ones.",
    ledger: load(allocatorRaw, "capital-allocator-insufficient"),
  },
];
