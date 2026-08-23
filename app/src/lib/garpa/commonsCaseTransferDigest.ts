import type { CapabilityGraph } from "../../types/garpaCapability";
import type {
  CapabilityGraphAdmissionReceipt,
  CommonsRetrievalPlan,
} from "../../types/garpaCommonsTransfer";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCapabilityGraphDigest(graph: CapabilityGraph): string {
  return sha256Hex(canonicalStringify(graph));
}

export function computeGraphAdmissionReceiptDigest(
  receipt: Omit<CapabilityGraphAdmissionReceipt, "receiptDigest">,
): string {
  return sha256Hex(canonicalStringify(receipt));
}

export function computeCommonsRetrievalPlanDigest(
  plan: Omit<CommonsRetrievalPlan, "planDigest">,
): string {
  return sha256Hex(canonicalStringify(plan));
}
