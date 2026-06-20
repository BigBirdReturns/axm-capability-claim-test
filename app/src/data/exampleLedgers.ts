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
    buttonLabel: "Load Example: Cleared Capability",
    blurb: "Acquit — A / Clean. Operating proof present, validation arms-length.",
    ledger: load(clearedRaw, "cleared-capability"),
  },
  {
    key: "circular",
    buttonLabel: "Load Example: Circular / Unproven",
    blurb: "Classify — C / Circular. Survivability proof substituting for operating proof.",
    ledger: load(circularRaw, "circular-unproven"),
  },
  {
    key: "insufficient",
    buttonLabel: "Load Example: Insufficient Ledger",
    blurb: "Refuse to verdict — fewer than three sourced fields. Pull-list only.",
    ledger: load(insufficientRaw, "insufficient-ledger"),
  },
  {
    key: "allocator_insufficient",
    buttonLabel: "Load Example: Capital Allocator / Insufficient Attribution Ledger",
    blurb: "Allocator route — attribution fields, not product seams. Pull-list only.",
    ledger: load(allocatorRaw, "capital-allocator-insufficient"),
  },
];
