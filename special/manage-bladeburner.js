import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const MAX_SKILL_BATCH = 1_000_000;
const MAX_SKILL_BATCHES_PER_RUN = 4_096;

function lowerChance(value) {
  return Array.isArray(value) ? Number(value[0]) : Number(value);
}

function validCost(value) {
  return Number.isFinite(value) && value > 0;
}

function largestAffordableBatch(bladeburner, skill, points, costCeiling) {
  const fits = (count) => {
    const total = Number(bladeburner.getSkillUpgradeCost(skill, count));
    if (!validCost(total) || total > points) return false;
    if (!Number.isFinite(costCeiling)) return true;
    const previous = count > 1
      ? Number(bladeburner.getSkillUpgradeCost(skill, count - 1))
      : 0;
    return total - previous <= costCeiling;
  };

  if (!fits(1)) return 0;
  let lower = 1;
  let upper = 2;
  while (upper <= MAX_SKILL_BATCH && fits(upper)) {
    lower = upper;
    upper *= 2;
  }
  upper = Math.min(upper, MAX_SKILL_BATCH);

  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (fits(middle)) lower = middle;
    else upper = middle - 1;
  }
  return lower;
}

export function spendSkillPoints(bladeburner) {
  const names = bladeburner.getSkillNames();
  const initialPoints = Number(bladeburner.getSkillPoints());
  let points = initialPoints;
  let upgrades = 0;
  let batches = 0;
  const unavailable = new Set();

  while (batches < MAX_SKILL_BATCHES_PER_RUN) {
    const skills = names
      .filter((name) => !unavailable.has(name))
      .map((name) => ({
        name,
        cost: Number(bladeburner.getSkillUpgradeCost(name, 1)),
      }))
      .filter(({ cost }) => validCost(cost))
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
    const cheapest = skills[0];
    if (!cheapest || cheapest.cost > points) break;

    const secondCost = skills[1]?.cost ?? Infinity;
    const costCeiling = Number.isFinite(secondCost)
      ? Math.max(secondCost, cheapest.cost * 2)
      : Infinity;
    let count = largestAffordableBatch(
      bladeburner,
      cheapest.name,
      points,
      costCeiling,
    );
    if (count < 1) break;

    if (!bladeburner.upgradeSkill(cheapest.name, count)) {
      count = 1;
      if (!bladeburner.upgradeSkill(cheapest.name, count)) {
        unavailable.add(cheapest.name);
        continue;
      }
    }

    upgrades += count;
    batches += 1;
    points = Number(bladeburner.getSkillPoints());
  }

  const cheapestRemaining = names
    .map((name) => Number(bladeburner.getSkillUpgradeCost(name, 1)))
    .filter(validCost)
    .sort((a, b) => a - b)[0] ?? Infinity;
  return {
    upgrades,
    spent: Math.max(0, initialPoints - points),
    remaining: points,
    drained: cheapestRemaining > points,
  };
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

  const skillSpending = spendSkillPoints(ns.bladeburner);

  ns.bladeburner.joinBladeburnerFaction();
  const action = chooseAction(ns);
  const current = ns.bladeburner.getCurrentAction();
  if (current?.type !== action.type || current?.name !== action.name) {
    ns.bladeburner.startAction(action.type, action.name);
  }
  const details = [`${action.type}: ${action.name}`];
  if (skillSpending.upgrades > 0) {
    details.push(
      `${skillSpending.upgrades} Bladeburner-Skill-Upgrades gekauft; ` +
      `${ns.format.number(skillSpending.remaining)} Punkte übrig.`,
    );
  }
  reportInfo(
    ns,
    `bladeburner-${action.type}-${action.name}`,
    "Bladeburner-Aktion gewählt",
    details,
  );
}
