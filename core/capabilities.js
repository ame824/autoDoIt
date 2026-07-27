import { hasApiAccess, sourceFileLevel } from "../lib/logic.js";

export function getCapabilities(ns) {
  const reset = ns.getResetInfo();
  return {
    reset,
    singularity: hasApiAccess(reset, [4], [4]),
    gang: hasApiAccess(reset, [2], [2]),
    corporation: hasApiAccess(reset, [3], [3]),
    sleeves: hasApiAccess(reset, [10], [10]),
    bladeburner: hasApiAccess(reset, [6, 7], [6, 7]),
    sourceFileLevel: (number) => sourceFileLevel(reset, number),
  };
}

