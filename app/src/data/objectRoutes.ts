import type { ObjectType, Route } from "../types/audit";

export type FieldSet = "product" | "allocator" | "offering" | "frontier" | "none";

export interface ObjectRouteDef {
  objectType: ObjectType;
  objectLabel: string;
  route: Route;
  routeLabel: string;
  whatYouAreTesting: string;
  // Which load-bearing field set applies. "none" => claim-only style routes.
  fieldSet: FieldSet;
  // Whether the product seam panel renders for this object.
  showsProductSeams: boolean;
}

// Object gate: wrong object, wrong test. The route is fixed by the object type
// before any seams render.
export const OBJECT_ROUTES: Record<ObjectType, ObjectRouteDef> = {
  product_company: {
    objectType: "product_company",
    objectLabel: "Product company",
    route: "operating_proof_contamination",
    routeLabel: "Operating proof + contamination",
    whatYouAreTesting: "Does the capability work",
    fieldSet: "product",
    showsProductSeams: true,
  },
  capital_allocator: {
    objectType: "capital_allocator",
    objectLabel: "Capital allocator (fund, syndicate, broker)",
    route: "attribution_proof_contamination",
    routeLabel: "Attribution proof + contamination",
    whatYouAreTesting: "Is the claimed judgment independently attributable",
    fieldSet: "allocator",
    showsProductSeams: false,
  },
  integrator_platform: {
    objectType: "integrator_platform",
    objectLabel: "Integrator / platform",
    route: "removal_test_operating_control_contamination",
    routeLabel: "Removal test + operating control + contamination",
    whatYouAreTesting: "Does the mission survive removal of the vendor",
    fieldSet: "product",
    showsProductSeams: true,
  },
  ranking_validator_media: {
    objectType: "ranking_validator_media",
    objectLabel: "Ranking / validator / media",
    route: "independence_proof_contamination",
    routeLabel: "Independence proof + contamination",
    whatYouAreTesting: "Is the legitimacy it confers independent",
    fieldSet: "product",
    showsProductSeams: false,
  },
  government_program_vehicle: {
    objectType: "government_program_vehicle",
    objectLabel: "Government program / vehicle",
    route: "removal_test_ownership",
    routeLabel: "Removal test + ownership",
    whatYouAreTesting: "Who owns the seams",
    fieldSet: "product",
    showsProductSeams: true,
  },
  capability_offering: {
    objectType: "capability_offering",
    objectLabel: "Capability offering (product, service, or system)",
    route: "mission_outcome_replication",
    routeLabel: "Claim packet + mission outcome admission",
    whatYouAreTesting:
      "What outcome is being bought, and is it specified well enough to engineer against",
    fieldSet: "offering",
    showsProductSeams: false,
  },
  frontier_model: {
    objectType: "frontier_model",
    objectLabel: "Frontier model (capability delta)",
    route: "capability_delta_replication",
    routeLabel: "Capability delta + replication pricing",
    whatYouAreTesting:
      "Is the claimed frontier delta independently measured, and what composition replicates it",
    fieldSet: "frontier",
    showsProductSeams: false,
  },
  claim_only: {
    objectType: "claim_only",
    objectLabel: "Claim only",
    route: "claim_test",
    routeLabel: "Tense, source class, baseline, beneficiary",
    whatYouAreTesting: "Tense, source class, baseline, beneficiary",
    fieldSet: "none",
    showsProductSeams: false,
  },
};

export const OBJECT_TYPE_OPTIONS: ObjectType[] = [
  "product_company",
  "capital_allocator",
  "integrator_platform",
  "ranking_validator_media",
  "government_program_vehicle",
  "capability_offering",
  "frontier_model",
  "claim_only",
];
