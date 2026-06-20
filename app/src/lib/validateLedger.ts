import type {
  Claim,
  EvidenceClass,
  Ledger,
  ObjectType,
  SeamState,
  Source,
} from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  ledger?: Ledger;
}

const EVIDENCE_CLASSES: EvidenceClass[] = [
  "confirmed",
  "reported",
  "derived",
  "judgment",
  "open",
];

const SEAM_STATES: SeamState[] = [
  "triggered",
  "not_triggered",
  "unclear",
  "not_applicable",
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// Parse + normalize an untrusted ledger payload (pasted JSON or example file)
// into the canonical Ledger shape. The schema is the mating surface, so this
// is deliberately strict about the load-bearing fields and lenient about
// optional analysis annotations.
export function validateLedger(input: unknown): ValidationResult {
  const errors: string[] = [];

  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
  }

  if (!isObject(raw)) {
    return { ok: false, errors: ["Ledger must be a JSON object."] };
  }

  const objectType = raw.objectType;
  if (typeof objectType !== "string" || !(objectType in OBJECT_ROUTES)) {
    errors.push(
      `objectType must be one of: ${Object.keys(OBJECT_ROUTES).join(", ")}.`,
    );
  }

  const targetName = raw.targetName;
  if (typeof targetName !== "string" || targetName.trim() === "") {
    errors.push("targetName is required.");
  }

  // Sources -----------------------------------------------------------------
  const sources: Source[] = [];
  const sourceIds = new Set<string>();
  if (!Array.isArray(raw.sources)) {
    errors.push("sources must be an array.");
  } else {
    raw.sources.forEach((s, i) => {
      if (!isObject(s)) {
        errors.push(`sources[${i}] must be an object.`);
        return;
      }
      if (typeof s.id !== "string") {
        errors.push(`sources[${i}].id is required.`);
        return;
      }
      if (typeof s.title !== "string") {
        errors.push(`sources[${i}].title is required.`);
        return;
      }
      sourceIds.add(s.id);
      sources.push({
        id: s.id,
        title: s.title,
        url: typeof s.url === "string" ? s.url : undefined,
        publisher: typeof s.publisher === "string" ? s.publisher : undefined,
        date: typeof s.date === "string" ? s.date : undefined,
        note: typeof s.note === "string" ? s.note : undefined,
      });
    });
  }

  // Claims ------------------------------------------------------------------
  const claims: Claim[] = [];
  if (!Array.isArray(raw.claims)) {
    errors.push("claims must be an array.");
  } else {
    raw.claims.forEach((c, i) => {
      if (!isObject(c)) {
        errors.push(`claims[${i}] must be an object.`);
        return;
      }
      if (typeof c.field !== "string") {
        errors.push(`claims[${i}].field is required.`);
        return;
      }
      if (typeof c.statement !== "string") {
        errors.push(`claims[${i}].statement is required.`);
        return;
      }
      const ec = c.evidenceClass;
      if (typeof ec !== "string" || !EVIDENCE_CLASSES.includes(ec as EvidenceClass)) {
        errors.push(
          `claims[${i}].evidenceClass must be one of: ${EVIDENCE_CLASSES.join(", ")}.`,
        );
        return;
      }
      const cIds = asStringArray(c.sourceIds);
      cIds.forEach((sid) => {
        if (!sourceIds.has(sid)) {
          errors.push(`claims[${i}] references unknown source "${sid}".`);
        }
      });
      claims.push({
        id: typeof c.id === "string" ? c.id : `claim_${i}`,
        field: c.field,
        statement: c.statement,
        evidenceClass: ec as EvidenceClass,
        confidence: typeof c.confidence === "number" ? c.confidence : undefined,
        sourceIds: cIds,
        notes: typeof c.notes === "string" ? c.notes : undefined,
      });
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const ledger: Ledger = {
    schemaVersion: 1,
    objectType: objectType as ObjectType,
    targetName: targetName as string,
    claims,
    sources,
    context: typeof raw.context === "string" ? raw.context : undefined,
  };

  // Optional analysis annotations (normalized, never fatal) -----------------
  if (Array.isArray(raw.seams)) {
    ledger.seams = raw.seams
      .filter(isObject)
      .filter((s) => typeof s.id === "string" && SEAM_STATES.includes(s.state as SeamState))
      .map((s) => ({
        id: s.id as string,
        question: typeof s.question === "string" ? s.question : undefined,
        state: s.state as SeamState,
        reason: typeof s.reason === "string" ? s.reason : undefined,
        sourceIds: asStringArray(s.sourceIds),
      }));
  }

  if (isObject(raw.contamination)) {
    const comp = Array.isArray(raw.contamination.components)
      ? raw.contamination.components
          .filter(isObject)
          .map((c) => ({
            key: c.key as never,
            present: c.present === true,
            reason: typeof c.reason === "string" ? c.reason : undefined,
            sourceIds: asStringArray(c.sourceIds),
            internalScore:
              typeof c.internalScore === "number" ? c.internalScore : undefined,
          }))
      : undefined;
    ledger.contamination = {
      bucket:
        typeof raw.contamination.bucket === "string"
          ? (raw.contamination.bucket as never)
          : undefined,
      components: comp,
    };
  }

  if (isObject(raw.verdictNotes)) {
    const v = raw.verdictNotes;
    ledger.verdictNotes = {
      state: typeof v.state === "string" ? (v.state as never) : undefined,
      loop: v.loop === "open" || v.loop === "closed" ? v.loop : undefined,
      rationale: typeof v.rationale === "string" ? v.rationale : undefined,
      largestGap: typeof v.largestGap === "string" ? v.largestGap : undefined,
      tenseOfProof: typeof v.tenseOfProof === "string" ? v.tenseOfProof : undefined,
      whatWouldClearIt:
        typeof v.whatWouldClearIt === "string" ? v.whatWouldClearIt : undefined,
      rootsBeliefSupplier:
        typeof v.rootsBeliefSupplier === "string" ? v.rootsBeliefSupplier : undefined,
      rootsValueRetainer:
        typeof v.rootsValueRetainer === "string" ? v.rootsValueRetainer : undefined,
      nextPulls: asStringArray(v.nextPulls),
    };
  }

  return { ok: true, errors: [], ledger };
}
