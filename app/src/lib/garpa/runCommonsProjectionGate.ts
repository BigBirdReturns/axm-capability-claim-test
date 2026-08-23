import type { ComponentObservation } from "../../types/garpaCommons";
import type {
  CommonsComponentProjectionFinding,
  CommonsComponentProjectionFindingState,
  CommonsComponentProjectionRequest,
  CommonsComponentProjectionResult,
} from "../../types/garpaCommonsProjection";
import { projectCommonsComponentCandidate } from "./projectCommonsComponentCandidate";
import { findCatalogEntry, validateCommonsCatalog } from "./validateCommonsCatalog";
import { validateCommonsComponentProjectionRequest } from "./validateCommonsProjection";

const PRIORITY: CommonsComponentProjectionFindingState[] = [
  "catalog_invalid",
  "catalog_digest_mismatch",
  "closure_receipt_invalid",
  "closure_not_compatibility_admitted",
  "source_object_missing",
  "source_object_type_invalid",
  "source_revision_missing",
  "source_revision_not_current",
  "source_coordinate_mismatch",
  "target_case_mismatch",
  "target_mapping_missing",
  "target_identity_evidence_missing",
  "target_evidence_incomplete",
];

function finding(
  state: CommonsComponentProjectionFindingState,
  reason: string,
  requiredAction: string,
): CommonsComponentProjectionFinding {
  return { state, reason, requiredAction };
}

function sourceMatches(
  source: ComponentObservation,
  request: CommonsComponentProjectionRequest,
): boolean {
  const receipt = request.compatibilityAdmissionReceipt;
  return (
    source.sourceCaseId === receipt.sourceCaseId &&
    source.sourceReleaseId === receipt.sourceReleaseId &&
    source.sourceReleaseDigest === receipt.sourceReleaseDigest
  );
}

export function runCommonsComponentProjectionGate(
  input: CommonsComponentProjectionRequest,
): CommonsComponentProjectionResult {
  const findings: CommonsComponentProjectionFinding[] = [];
  const validated = validateCommonsComponentProjectionRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "closure_receipt_invalid",
      findings: validated.errors.map((error) =>
        finding("closure_receipt_invalid", error, "Repair the projection request and rerun validation."),
      ),
    };
  }
  const request = validated.value;
  const catalog = validateCommonsCatalog(request.catalog);
  if (!catalog.ok || !catalog.value) {
    findings.push(
      finding("catalog_invalid", catalog.errors.join("; "), "Supply a valid content-addressed Commons catalog."),
    );
  } else if (request.expectedCatalogDigest !== catalog.value.catalogDigest) {
    findings.push(
      finding(
        "catalog_digest_mismatch",
        "The expected catalog digest does not match the validated catalog.",
        "Rebuild the request against the current exact catalog digest.",
      ),
    );
  }

  const receipt = request.compatibilityAdmissionReceipt;
  if (receipt.disposition !== "compatibility_admitted") {
    findings.push(
      finding(
        "closure_not_compatibility_admitted",
        "Only a compatibility_admitted target-case closure may enter component projection.",
        "Complete target identity, interface, environment, and requalification closure first.",
      ),
    );
  }
  if (receipt.targetCaseId !== request.targetEvidence.targetCaseId) {
    findings.push(
      finding(
        "target_case_mismatch",
        "The target evidence packet belongs to a different case than the closure receipt.",
        "Bind the target evidence packet to the exact closure target case.",
      ),
    );
  }
  if (receipt.targetFunctionIds.length === 0 || receipt.targetInterfaceIds.length === 0) {
    findings.push(
      finding(
        "target_mapping_missing",
        "The closure receipt does not map the source observation to target functions and interfaces.",
        "Record target graph mappings in the compatibility closure.",
      ),
    );
  }
  if (
    request.targetEvidence.identityEvidenceCellIds.length === 0 ||
    receipt.targetIdentityReceiptIds.length === 0
  ) {
    findings.push(
      finding(
        "target_identity_evidence_missing",
        "Exact source identity cannot enter the target component contract without target identity evidence and receipt custody.",
        "Recover exact target-version identity evidence and close the identity receipt.",
      ),
    );
  }

  let source: ComponentObservation | undefined;
  if (catalog.value) {
    const entry = findCatalogEntry(
      catalog.value,
      "component_observation",
      receipt.catalogObjectId,
    );
    if (!entry) {
      const wrongType = [
        ...catalog.value.primitiveEntries,
        ...catalog.value.architecturePatternEntries,
      ].some((candidate) => candidate.catalogObjectId === receipt.catalogObjectId);
      findings.push(
        finding(
          wrongType ? "source_object_type_invalid" : "source_object_missing",
          wrongType
            ? "The referenced catalog object is not a component observation."
            : "The referenced component observation is absent from the catalog.",
          "Reference one exact component-observation catalog object.",
        ),
      );
    } else {
      const revision = entry.revisions.find((item) => item.revisionId === receipt.revisionId);
      if (!revision) {
        findings.push(
          finding(
            "source_revision_missing",
            "The referenced immutable revision is absent from the catalog entry.",
            "Reference an existing exact revision and object digest.",
          ),
        );
      } else {
        if (revision.state !== "current") {
          findings.push(
            finding(
              "source_revision_not_current",
              `The referenced component revision is ${revision.state}.`,
              "Use the current exact revision; historical revisions remain research context only.",
            ),
          );
        }
        if (
          revision.objectDigest !== receipt.objectDigest ||
          revision.sourceCaseId !== receipt.sourceCaseId ||
          revision.sourceReleaseId !== receipt.sourceReleaseId ||
          revision.sourceReleaseDigest !== receipt.sourceReleaseDigest
        ) {
          findings.push(
            finding(
              "source_coordinate_mismatch",
              "The closure receipt does not match the immutable catalog revision and source coordinates.",
              "Regenerate the closure receipt from the exact catalog revision.",
            ),
          );
        }
        source = revision.value as ComponentObservation;
        if (!sourceMatches(source, request)) {
          findings.push(
            finding(
              "source_coordinate_mismatch",
              "The stored component observation carries different source coordinates from the closure receipt.",
              "Use the source coordinates embedded in the immutable observation.",
            ),
          );
        }
      }
    }
  }

  if (findings.length > 0 || !source) {
    const state = PRIORITY.find((item) => findings.some((entry) => entry.state === item)) ??
      "target_evidence_incomplete";
    return { passed: false, state, findings };
  }

  const projected = projectCommonsComponentCandidate(request, source);
  return {
    passed: true,
    state: "component_projection_admitted",
    readiness: projected.readiness,
    findings: [],
    projected,
  };
}
