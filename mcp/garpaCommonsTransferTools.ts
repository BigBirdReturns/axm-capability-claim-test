import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildCommonsRetrievalPlan, executeCommonsRetrievalPlan } from "../app/src/lib/garpa/buildCommonsRetrievalPlan.ts";
import {
  renderCommonsRetrievalExecutionMarkdown,
  renderCommonsRetrievalPlanMarkdown,
  renderCommonsTransferMarkdown,
} from "../app/src/lib/garpa/renderCommonsTransfer.ts";
import { runCommonsTransferGate } from "../app/src/lib/garpa/runCommonsTransferGate.ts";
import { validateCapabilityGraph } from "../app/src/lib/garpa/validateCapabilityGraph.ts";
import { validateCommonsCatalog } from "../app/src/lib/garpa/validateCommonsCatalog.ts";
import {
  validateCommonsRetrievalPlan,
  validateCommonsTransferRequest,
  validateGraphAdmissionReceipt,
} from "../app/src/lib/garpa/validateCommonsTransfer.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

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

function parseJsonInput(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return input;
  }
}

export function registerGarpaCommonsTransferTools(server: McpServer): void {
  server.registerTool(
    "build_garpa_commons_retrieval_plan",
    {
      title: "Build a target-case GARPA commons retrieval plan",
      description:
        "Builds a deterministic set of function and interface retrieval tasks from one admitted target capability graph and one exact commons catalog revision. The plan binds both digests and explicitly prohibits promotion into component evidence, compatibility, architecture, qualification, procurement, testing, deployment, or equivalence.",
      inputSchema: {
        catalog: JSON_INPUT,
        expectedCatalogDigest: z.string().min(1),
        targetCapabilityGraph: JSON_INPUT,
        targetCapabilityGraphDigest: z.string().min(1),
        targetGraphAdmissionReceipt: JSON_INPUT,
      },
    },
    async ({
      catalog,
      expectedCatalogDigest,
      targetCapabilityGraph,
      targetCapabilityGraphDigest,
      targetGraphAdmissionReceipt,
    }) => {
      const validatedCatalog = validateCommonsCatalog(parseJsonInput(catalog));
      const validatedGraph = validateCapabilityGraph(
        parseJsonInput(targetCapabilityGraph),
      );
      const validatedReceipt = validateGraphAdmissionReceipt(
        parseJsonInput(targetGraphAdmissionReceipt),
      );
      const errors = [
        ...validatedCatalog.errors.map((error) => `catalog: ${error}`),
        ...validatedGraph.errors.map((error) => `targetCapabilityGraph: ${error}`),
        ...validatedReceipt.errors.map(
          (error) => `targetGraphAdmissionReceipt: ${error}`,
        ),
      ];
      if (
        !validatedCatalog.value ||
        !validatedGraph.value ||
        !validatedReceipt.value
      ) {
        return text({ ok: false, errors });
      }
      const result = buildCommonsRetrievalPlan({
        catalog: validatedCatalog.value,
        expectedCatalogDigest,
        targetCapabilityGraph: validatedGraph.value,
        targetCapabilityGraphDigest,
        targetGraphAdmissionReceipt: validatedReceipt.value,
      });
      return text({
        ok: result.passed,
        errors: result.errors,
        plan: result.plan,
        markdown: result.plan
          ? renderCommonsRetrievalPlanMarkdown(result.plan)
          : undefined,
      });
    },
  );

  server.registerTool(
    "execute_garpa_commons_retrieval_plan",
    {
      title: "Execute a GARPA commons retrieval plan",
      description:
        "Executes the deterministic plan against the supplied content-addressed catalog. Results preserve exact revision, object digest, source release, target task mappings, and source context. No score or downstream admission is produced.",
      inputSchema: {
        catalog: JSON_INPUT,
        plan: JSON_INPUT,
      },
    },
    async ({ catalog, plan }) => {
      const result = executeCommonsRetrievalPlan(
        parseJsonInput(catalog),
        parseJsonInput(plan),
      );
      return text({
        ok: result.passed,
        result,
        markdown: renderCommonsRetrievalExecutionMarkdown(result),
      });
    },
  );

  server.registerTool(
    "validate_garpa_commons_transfer",
    {
      title: "Validate a GARPA commons case-transfer request",
      description:
        "Validates the target graph, catalog, graph-admission receipt, deterministic retrieval plan, exact revision nominations, mappings, scope comparisons, boundary acknowledgements, and required target-case evidence and qualification work.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsTransferRequest(parseJsonInput(request));
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_transfer",
    {
      title: "Run the GARPA commons case-transfer gate",
      description:
        "Nominates exact commons revisions into a new case as research leads or candidate inputs only. The gate recomputes catalog and graph custody, preserves every residual and limitation, checks target mappings and scope, and refuses any implicit promotion into evidence, compatibility, coverage, architecture, qualification, procurement, testing, deployment, or equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsTransferRequest(parseJsonInput(request));
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsTransferGate(validated.value);
      return text({
        ok: true,
        transferBlocked: !result.passed,
        result,
        markdown: renderCommonsTransferMarkdown(validated.value, result),
      });
    },
  );
}
