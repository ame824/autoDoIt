import {
  chooseCheapestFactionAugmentation,
  chooseNeuroFluxFaction,
  collectFactionAugmentationOptions,
} from "./faction-augmentations.js";
import { chooseCriticalAugmentation } from "./node-rush.js";

export const FACTION_PLAN_FILE = "/data/autoDoIt-faction-plan.txt";
export const FACTION_PLAN_TTL_MS = 2 * 60_000;

export function findRepTarget(ns, factions, owned) {
  const specific = collectFactionAugmentationOptions(ns, factions, owned);
  const target = chooseCheapestFactionAugmentation(specific.filter(({ gap }) => gap > 0));
  if (target) return { ...target, augmentation: target.name, neuroFluxStage: false };
  if (specific.length > 0) return null;
  const neuroFlux = chooseNeuroFluxFaction(
    collectFactionAugmentationOptions(ns, factions, owned, true),
  );
  return neuroFlux ? { ...neuroFlux, augmentation: neuroFlux.name, neuroFluxStage: true } : null;
}

export function buildFactionPlan(ns, factions, owned, gangFaction = "", now = Date.now()) {
  const specific = collectFactionAugmentationOptions(ns, factions, owned);
  const critical = chooseCriticalAugmentation(specific);
  const purchaseTarget = critical ?? chooseCheapestFactionAugmentation(specific);
  let workTarget = critical?.gap > 0
    ? critical
    : chooseCheapestFactionAugmentation(specific.filter(({ gap }) => gap > 0));
  let neuroFluxTarget = null;
  if (specific.length === 0) {
    const allNeuroFlux = collectFactionAugmentationOptions(ns, factions, owned, true);
    neuroFluxTarget = chooseNeuroFluxFaction(allNeuroFlux);
    workTarget = chooseNeuroFluxFaction(allNeuroFlux.filter(({ faction }) => faction !== gangFaction));
  }
  const decorate = (target, neuroFluxStage = false) => target ? {
    ...target,
    augmentation: target.name,
    neuroFluxStage,
  } : null;
  return {
    updatedAt: Number(now),
    specificRemaining: specific.length,
    purchaseTarget: decorate(purchaseTarget ?? neuroFluxTarget, specific.length === 0),
    workTarget: decorate(workTarget, specific.length === 0),
  };
}

export function parseFactionPlan(raw, now = Date.now()) {
  let plan;
  try { plan = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
  if (!plan || typeof plan !== "object") return null;
  const updatedAt = Number(plan.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt > now + 60_000 || now - updatedAt > FACTION_PLAN_TTL_MS) return null;
  return {
    updatedAt,
    specificRemaining: Math.max(0, Number(plan.specificRemaining) || 0),
    purchaseTarget: plan.purchaseTarget && typeof plan.purchaseTarget === "object" ? plan.purchaseTarget : null,
    workTarget: plan.workTarget && typeof plan.workTarget === "object" ? plan.workTarget : null,
  };
}
