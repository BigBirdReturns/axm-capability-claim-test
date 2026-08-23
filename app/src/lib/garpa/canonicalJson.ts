function normalizeValue(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child !== undefined) normalized[key] = normalizeValue(child);
    }
    return normalized;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Canonical JSON does not permit non-finite numbers.");
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}
