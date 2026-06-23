import type { Ledger, ObjectType } from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";
import { fieldsForSet } from "../data/loadBearingFields";

// Retrieval and analysis are separate layers. The neutral prompt is mechanical,
// object-scoped, and carries no verdict language. It asks for nodes, not a
// conclusion about them.
export function generateNeutralPrompt(ledger: Ledger): string {
  const def = OBJECT_ROUTES[ledger.objectType];
  const fields = fieldsForSet(def.fieldSet);
  const fieldLines = fields.map((f) => `- ${f.label}`).join("\n");

  return [
    `Build a sourced ledger for the following public object. Retrieval only — do not assess, rank, or conclude.`,
    ``,
    `Object: ${ledger.targetName}`,
    `Object type: ${def.objectLabel} (${def.objectType})`,
    `Scope: public structural record only — the entity acting in a public capacity. Do not assemble a private individual's life.`,
    ``,
    `Collect, for each item: claim / source (with URL or citation) / evidence class (confirmed, reported, derived, judgment, open) / confidence / notes.`,
    `Use judgment only for analyst interpretation; it will not count toward the three-field sourcing gate.`,
    ``,
    `Load-bearing fields to populate:`,
    fieldLines || `- (claim-only: tense, source class, baseline, beneficiary)`,
    ``,
    `Also collect the structural nodes: investors, board roles, validators, rankings, co-investors, and affiliations.`,
    ``,
    `Return strictly as JSON matching the ledger schema (objectType, targetName, sources[], claims[]). Do not include analysis or a verdict.`,
  ].join("\n");
}

// Loaded-request sanitization. Convert an accusatory, verdict-fused request
// into neutral, object-scoped retrieval. Do not refuse, moralize, or erase
// named public structural nodes.
export function sanitizeLoadedRequest(input: string): {
  neutral: string;
  target: string | null;
  objectTypeGuess: ObjectType;
} {
  const trimmed = input.trim();

  // Extract a probable target name after "behind", "around", or "of".
  const m = trimmed.match(/\b(?:behind|around|of|for)\s+(.+?)[.?!]?$/i);
  const target = m?.[1]?.trim() ?? null;

  const neutral = target
    ? `Build a sourced ledger of investors, board roles, validators, rankings, co-investors, and affiliations for ${target}.`
    : `Build a sourced ledger of investors, board roles, validators, rankings, co-investors, and affiliations.`;

  // Default to product_company unless allocator language is present.
  const objectTypeGuess: ObjectType = /\b(vc|fund|syndicate|investor|allocator|capital)\b/i.test(
    trimmed,
  )
    ? "capital_allocator"
    : "product_company";

  return { neutral, target, objectTypeGuess };
}
