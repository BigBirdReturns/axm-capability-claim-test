import type { Ledger, ObjectGateResult } from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";

// Step 0. Object gate — runs first, always. Wrong object, wrong test.
// The route is fixed by the object type before any seams render, so a capital
// allocator can never be forced through the product-company instrument.
export function runObjectGate(ledger: Ledger): ObjectGateResult {
  const def = OBJECT_ROUTES[ledger.objectType];
  return {
    objectType: def.objectType,
    objectLabel: def.objectLabel,
    route: def.route,
    routeLabel: def.routeLabel,
    whatYouAreTesting: def.whatYouAreTesting,
  };
}
