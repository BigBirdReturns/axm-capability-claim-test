import { useMemo } from "react";
import type { Claim, EvidenceClass, Ledger, ObjectType } from "../types/audit";
import { OBJECT_ROUTES, OBJECT_TYPE_OPTIONS } from "../data/objectRoutes";
import { fieldsForSet } from "../data/loadBearingFields";

const EVIDENCE_CLASSES: EvidenceClass[] = [
  "confirmed",
  "reported",
  "derived",
  "judgment",
  "open",
];

// Manual mode. Edit the object type and one claim row per load-bearing field.
// Sources are managed inline as a simple list; each claim cites source ids.
export function SourceLedgerForm({
  ledger,
  onChange,
}: {
  ledger: Ledger;
  onChange: (next: Ledger) => void;
}) {
  const def = OBJECT_ROUTES[ledger.objectType];
  const fields = useMemo(() => fieldsForSet(def.fieldSet), [def.fieldSet]);

  function setObjectType(objectType: ObjectType) {
    onChange({ ...ledger, objectType });
  }

  function upsertClaim(field: string, patch: Partial<Claim>) {
    const existing = ledger.claims.find((c) => c.field === field);
    let claims: Claim[];
    if (existing) {
      claims = ledger.claims.map((c) =>
        c.field === field ? { ...c, ...patch } : c,
      );
    } else {
      claims = [
        ...ledger.claims,
        {
          id: `claim_${field}`,
          field,
          statement: "",
          evidenceClass: "open",
          sourceIds: [],
          ...patch,
        },
      ];
    }
    onChange({ ...ledger, claims });
  }

  function addSource() {
    const id = `s${ledger.sources.length + 1}`;
    onChange({
      ...ledger,
      sources: [...ledger.sources, { id, title: "" }],
    });
  }

  function patchSource(id: string, patch: Partial<Ledger["sources"][number]>) {
    onChange({
      ...ledger,
      sources: ledger.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  return (
    <section className="panel">
      <h2>Source ledger (manual mode)</h2>

      <label className="field">
        <span>Object type</span>
        <select
          value={ledger.objectType}
          onChange={(e) => setObjectType(e.target.value as ObjectType)}
        >
          {OBJECT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {OBJECT_ROUTES[t].objectLabel}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Target name</span>
        <input
          type="text"
          value={ledger.targetName}
          onChange={(e) => onChange({ ...ledger, targetName: e.target.value })}
          placeholder="Public object name"
        />
      </label>

      <h3>Sources</h3>
      {ledger.sources.map((s) => (
        <div key={s.id} className="source-row">
          <code>{s.id}</code>
          <input
            type="text"
            value={s.title}
            placeholder="Title / publisher"
            onChange={(e) => patchSource(s.id, { title: e.target.value })}
          />
          <input
            type="text"
            value={s.url ?? ""}
            placeholder="URL"
            onChange={(e) => patchSource(s.id, { url: e.target.value })}
          />
        </div>
      ))}
      <button type="button" className="ghost" onClick={addSource}>
        + Add source
      </button>

      <h3>Load-bearing fields</h3>
      {fields.length === 0 && (
        <p className="muted">
          Claim-only route: assess tense, source class, baseline, beneficiary.
        </p>
      )}
      {fields.map((f) => {
        const claim = ledger.claims.find((c) => c.field === f.field);
        return (
          <div key={f.field} className="claim-row">
            <label className="claim-label">{f.label}</label>
            <input
              type="text"
              value={claim?.statement ?? ""}
              placeholder="Claim statement"
              onChange={(e) => upsertClaim(f.field, { statement: e.target.value })}
            />
            <select
              value={claim?.evidenceClass ?? "open"}
              onChange={(e) =>
                upsertClaim(f.field, {
                  evidenceClass: e.target.value as EvidenceClass,
                })
              }
            >
              {EVIDENCE_CLASSES.map((ec) => (
                <option key={ec} value={ec}>
                  {ec}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={(claim?.sourceIds ?? []).join(",")}
              placeholder="source ids, e.g. s1,s2"
              onChange={(e) =>
                upsertClaim(f.field, {
                  sourceIds: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        );
      })}
    </section>
  );
}
