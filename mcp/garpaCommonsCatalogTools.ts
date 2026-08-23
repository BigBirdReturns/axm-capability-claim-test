import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateCommonsCatalog,
  validateCommonsCatalogUpdateRequest,
} from "../app/src/lib/garpa/validateCommonsCatalog.ts";
import { applyCommonsCatalogUpdate } from "../app/src/lib/garpa/applyCommonsCatalogUpdate.ts";
import { searchCommonsCatalog } from "../app/src/lib/garpa/searchCommonsCatalog.ts";
import {
  renderCommonsCatalogUpdateMarkdown,
  renderCommonsSearchMarkdown,
} from "../app/src/lib/garpa/renderCommonsCatalogUpdate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);
const OBJECT_TYPE = z.enum([
  "primitive",
  "component_observation",
  "architecture_pattern",
]);
const EXECUTION_CLASS = z.enum([
  "E0_analysis_only",
  "E1_simulation_or_replay",
  "E2_bench_passive",
  "E3_controlled_field_inert",
  "E4_regulated_active",
  "E5_operational_environment",
]);

function text(content: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
      },
    ],
  };
}

export function registerGarpaCommonsCatalogTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_commons_catalog",
    {
      title: "Validate a GARPA capability-commons catalog object",
      description:
        "Validates either a content-addressed commons catalog or a catalog update request. Catalog validation checks canonical catalog and object digests, contiguous revision chains, current pointers, stable identities, source coordinates, aliases, and collection placement. Update validation also checks the embedded commons admission request and operation envelope.",
      inputSchema: {
        kind: z.enum(["catalog", "update_request"]),
        payload: JSON_INPUT,
      },
    },
    async ({ kind, payload }) => {
      const result = kind === "catalog"
        ? validateCommonsCatalog(payload)
        : validateCommonsCatalogUpdateRequest(payload);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "apply_garpa_commons_catalog_update",
    {
      title: "Apply a GARPA capability-commons catalog update",
      description:
        "Recomputes commons admission, checks optimistic catalog custody, enforces exactly one create, supersede, or noop operation per admitted object, refuses blocked objects and identity collisions, and returns a candidate next catalog plus an update receipt. It never overwrites a prior object revision.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsCatalogUpdateRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = applyCommonsCatalogUpdate(validated.value);
      return text({
        ok: true,
        updateBlocked: !result.gate.passed,
        result,
        markdown: renderCommonsCatalogUpdateMarkdown(validated.value, result),
      });
    },
  );

  server.registerTool(
    "search_garpa_commons_catalog",
    {
      title: "Search a GARPA capability-commons catalog",
      description:
        "Searches exact catalog revisions by text and structured provenance, function, interface, execution, maturity, and evidence-state filters. Current revisions are returned by default. Results preserve source release, fixture, environment, residuals, falsification conditions, and the complete stored object. No scalar score is produced.",
      inputSchema: {
        catalog: JSON_INPUT,
        query: z.object({
          text: z.string().optional(),
          objectTypes: z.array(OBJECT_TYPE).optional(),
          sourceCaseIds: z.array(z.string().min(1)).optional(),
          sourceReleaseIds: z.array(z.string().min(1)).optional(),
          functionIds: z.array(z.string().min(1)).optional(),
          interfaceIds: z.array(z.string().min(1)).optional(),
          executionClasses: z.array(EXECUTION_CLASS).optional(),
          primitiveMaturities: z
            .array(
              z.enum([
                "concept",
                "candidate",
                "bench_observed",
                "field_observed",
                "repeated",
              ]),
            )
            .optional(),
          componentStates: z
            .array(
              z.enum([
                "vendor_claimed",
                "externally_reported",
                "locally_observed",
                "locally_qualified",
              ]),
            )
            .optional(),
          includeSuperseded: z.boolean().optional(),
          includeWithdrawn: z.boolean().optional(),
          limit: z.number().int().min(1).max(500).optional(),
        }),
      },
    },
    async ({ catalog, query }) => {
      const validated = validateCommonsCatalog(catalog);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = searchCommonsCatalog(validated.value, query);
      return text({
        ok: true,
        result,
        markdown: renderCommonsSearchMarkdown(result),
      });
    },
  );
}
