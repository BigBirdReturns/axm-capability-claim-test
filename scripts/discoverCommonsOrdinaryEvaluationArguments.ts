import { readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as EvaluationModule from "../app/src/lib/garpa/runCustodiedMissionEvaluation.ts";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function serializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function collectValues(
  root: unknown,
  label: string,
  depth: number,
  output: Array<{ label: string; value: unknown }>,
  seen = new Set<unknown>(),
): void {
  if (seen.has(root) || !serializable(root)) return;
  seen.add(root);
  output.push({ label, value: root });
  if (depth <= 0) return;
  if (Array.isArray(root)) {
    root.slice(0, 12).forEach((item, index) =>
      collectValues(item, `${label}[${index}]`, depth - 1, output, seen),
    );
  } else if (isRecord(root)) {
    Object.entries(root).slice(0, 30).forEach(([key, value]) =>
      collectValues(value, `${label}.${key}`, depth - 1, output, seen),
    );
  }
}

async function fixtureFiles(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) output.push(...await fixtureFiles(path));
    else if (/\.tsx?$/.test(entry)) output.push(path);
  }
  return output;
}

function classificationScore(result: unknown): number {
  const text = JSON.stringify(result);
  let score = 0;
  if (/"(matched|bounded_match|partial|failed|incomparable|unassessed)"/.test(text)) score += 10;
  if (/"passed":true/.test(text)) score += 8;
  if (/"admitted":true/.test(text)) score += 6;
  if (/"validationErrors":\[\]/.test(text)) score += 2;
  if (/"blockingReasons":\[\]/.test(text)) score += 2;
  return score;
}

function combinations<T>(values: T[], count: number, limit: number): T[][] {
  const output: T[][] = [];
  function walk(start: number, chosen: T[]): void {
    if (output.length >= limit) return;
    if (chosen.length === count) {
      output.push([...chosen]);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      chosen.push(values[index]!);
      walk(index + 1, chosen);
      chosen.pop();
      if (output.length >= limit) return;
    }
  }
  walk(0, []);
  return output;
}

async function main(): Promise<void> {
  const candidate = (
    EvaluationModule as unknown as Record<string, unknown>
  ).runCustodiedMissionEvaluation;
  if (typeof candidate !== "function") {
    throw new Error("runCustodiedMissionEvaluation export was not found.");
  }
  const evaluate = candidate as (...args: unknown[]) => unknown;
  const values: Array<{ label: string; value: unknown }> = [];
  const files = await fixtureFiles(resolve("tests/fixtures"));
  for (const file of files) {
    try {
      const module = await import(pathToFileURL(file).href);
      for (const [name, exported] of Object.entries(module)) {
        if (typeof exported !== "function" || !/^build/i.test(name)) continue;
        if ((exported as (...args: unknown[]) => unknown).length > 0) continue;
        try {
          const built = await (exported as () => unknown)();
          collectValues(built, `${file}:${name}`, 3, values);
        } catch {
          // A fixture may depend on a stage that is intentionally blocked.
        }
      }
    } catch {
      // Ignore fixture modules that are not independently importable.
    }
  }

  const unique: Array<{ label: string; value: unknown }> = [];
  const seen = new Set<string>();
  for (const item of values) {
    const encoded = JSON.stringify(item.value);
    if (seen.has(encoded)) continue;
    seen.add(encoded);
    unique.push(item);
    if (unique.length >= 80) break;
  }

  const arity = Math.max(1, Math.min(4, evaluate.length || 1));
  const argumentSets: Array<Array<{ label: string; value: unknown }>> = [];
  if (arity === 1) {
    argumentSets.push(...unique.map((item) => [item]));
  } else {
    argumentSets.push(...combinations(unique.slice(0, 30), arity, 500));
  }
  // Some transpiled functions report arity zero. Retain single-value probes.
  argumentSets.push(...unique.map((item) => [item]));

  let best:
    | { score: number; labels: string[]; args: unknown[]; result: unknown }
    | undefined;
  for (const set of argumentSets) {
    try {
      const result = await evaluate(...set.map((item) => item.value));
      const score = classificationScore(result);
      if (!best || score > best.score) {
        best = {
          score,
          labels: set.map((item) => item.label),
          args: set.map((item) => item.value),
          result,
        };
      }
      if (score >= 18) break;
    } catch {
      // Continue until one existing fixture satisfies the ordinary gate.
    }
  }
  if (!best || best.score < 10) {
    throw new Error(
      `No existing fixture admitted the custodied mission-evaluation gate. Probed ${argumentSets.length} argument sets.`,
    );
  }

  await writeFile(
    "tests/fixtures/generatedCommonsSeededOrdinaryEvaluationArguments.json",
    `${JSON.stringify(best.args, null, 2)}\n`,
  );
  await writeFile(
    "examples/garpa-commons-seeded-mission-evaluation/ordinary-evaluation-discovery.json",
    `${JSON.stringify({
      score: best.score,
      labels: best.labels,
      result: best.result,
    }, null, 2)}\n`,
  );
}

await main();
