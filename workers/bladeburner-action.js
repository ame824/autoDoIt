import { reportInfo } from "../core/notifier.js";

const lowerChance = (value) => Array.isArray(value) ? Number(value[0]) : Number(value);

export function chooseAction(ns) {
  const types = ns.enums.BladeburnerActionType;
  const [stamina, maximum] = ns.bladeburner.getStamina();
  const city = ns.bladeburner.getCity();
  if (stamina < maximum * 0.55) return { type: types.General, name: "Hyperbolic Regeneration Chamber" };
  if (ns.bladeburner.getCityChaos(city) > 50) return { type: types.General, name: "Diplomacy" };
  const blackOp = ns.bladeburner.getNextBlackOp();
  if (blackOp && ns.bladeburner.getRank() >= blackOp.rank &&
      lowerChance(ns.bladeburner.getActionEstimatedSuccessChance(types.BlackOp, blackOp.name)) >= 0.95) {
    return { type: types.BlackOp, name: blackOp.name };
  }
  const candidates = [
    ...ns.bladeburner.getOperationNames().map((name) => ({ type: types.Operation, name })),
    ...ns.bladeburner.getContractNames().map((name) => ({ type: types.Contract, name })),
  ].filter(({ type, name }) => ns.bladeburner.getActionCountRemaining(type, name) > 0)
    .map((action) => ({
      ...action,
      chance: lowerChance(ns.bladeburner.getActionEstimatedSuccessChance(action.type, action.name)),
      score: ns.bladeburner.getActionRankGain(action.type, action.name) /
        Math.max(1, ns.bladeburner.getActionTime(action.type, action.name)),
    })).filter(({ chance }) => chance >= 0.80)
    .sort((left, right) => right.score - left.score);
  return candidates[0] ?? { type: types.General, name: "Field Analysis" };
}

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.bladeburner.inBladeburner()) return;
  ns.bladeburner.joinBladeburnerFaction();
  const action = chooseAction(ns);
  const current = ns.bladeburner.getCurrentAction();
  if (current?.type !== action.type || current?.name !== action.name) {
    ns.bladeburner.startAction(action.type, action.name);
  }
  reportInfo(ns, `bladeburner-${action.type}-${action.name}`, "Bladeburner-Aktion gewählt", [
    `${action.type}: ${action.name}`,
  ]);
}
