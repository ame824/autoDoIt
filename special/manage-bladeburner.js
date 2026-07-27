import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

function lowerChance(value) {
  return Array.isArray(value) ? Number(value[0]) : Number(value);
}

export function chooseAction(ns) {
  const actionTypes = ns.enums.BladeburnerActionType;
  const [stamina, maxStamina] = ns.bladeburner.getStamina();
  const city = ns.bladeburner.getCity();
  if (stamina < maxStamina * 0.55) {
    return { type: actionTypes.General, name: "Hyperbolic Regeneration Chamber" };
  }
  if (ns.bladeburner.getCityChaos(city) > 50) {
    return { type: actionTypes.General, name: "Diplomacy" };
  }

  const nextBlackOp = ns.bladeburner.getNextBlackOp();
  if (
    nextBlackOp &&
    ns.bladeburner.getRank() >= nextBlackOp.rank &&
    lowerChance(
      ns.bladeburner.getActionEstimatedSuccessChance(actionTypes.BlackOp, nextBlackOp.name),
    ) >= 0.95
  ) {
    return { type: actionTypes.BlackOp, name: nextBlackOp.name };
  }

  const candidates = [
    ...ns.bladeburner.getOperationNames().map((name) => ({ type: actionTypes.Operation, name })),
    ...ns.bladeburner.getContractNames().map((name) => ({ type: actionTypes.Contract, name })),
  ]
    .filter(({ type, name }) => ns.bladeburner.getActionCountRemaining(type, name) > 0)
    .map((action) => ({
      ...action,
      chance: lowerChance(ns.bladeburner.getActionEstimatedSuccessChance(action.type, action.name)),
      score:
        ns.bladeburner.getActionRankGain(action.type, action.name) /
        Math.max(1, ns.bladeburner.getActionTime(action.type, action.name)),
    }))
    .filter(({ chance }) => chance >= 0.80)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? { type: actionTypes.General, name: "Field Analysis" };
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.bladeburner) {
    reportBlocker(ns, "bladeburner-api", "Bladeburner-Automatisierung ist gesperrt", [
      "Die API benötigt BitNode 6/7 oder Source-File 6/7.",
    ], [
      "Ein entsprechendes BitNode abschließen.",
    ]);
    return;
  }

  if (!ns.bladeburner.inBladeburner()) {
    if (ns.bladeburner.joinBladeburnerDivision()) {
      reportSuccess(ns, "bladeburner-joined", "Bladeburner-Division beigetreten");
    } else {
      if (capabilities.singularity) {
        const skills = ns.getPlayer().skills;
        const combat = [
          ["str", skills.strength],
          ["def", skills.defense],
          ["dex", skills.dexterity],
          ["agi", skills.agility],
        ].sort((a, b) => a[1] - b[1]);
        if (combat[0][1] < 100) {
          ns.singularity.travelToCity("Sector-12");
          ns.singularity.gymWorkout("Powerhouse Gym", combat[0][0], false);
          reportInfo(ns, `bladeburner-train-${combat[0][0]}`, "Training für Bladeburner gestartet", [
            `${combat[0][0]}: ${combat[0][1].toFixed(0)} / 100`,
          ]);
          return;
        }
      }
      reportBlocker(ns, "bladeburner-join", "Bladeburner-Aufnahmekriterien fehlen", [
        "Für den Beitritt werden ausreichend hohe Kampfwerte benötigt.",
      ], [
        "Stärke, Verteidigung, Geschicklichkeit und Agilität trainieren.",
      ]);
      return;
    }
  }

  let points = ns.bladeburner.getSkillPoints();
  const skills = ns.bladeburner
    .getSkillNames()
    .map((name) => ({ name, cost: ns.bladeburner.getSkillUpgradeCost(name, 1) }))
    .sort((a, b) => a.cost - b.cost);
  for (const skill of skills) {
    if (skill.cost > points) break;
    if (ns.bladeburner.upgradeSkill(skill.name, 1)) points -= skill.cost;
  }

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
