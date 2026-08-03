import { reportInfo } from "../core/notifier.js";

const MAX_SKILL_BATCH = 1_000_000;
const MAX_SKILL_BATCHES_PER_RUN = 4_096;
const validCost = (value) => Number.isFinite(value) && value > 0;

function largestAffordableBatch(bladeburner, skill, points, costCeiling) {
  const fits = (count) => {
    const total = Number(bladeburner.getSkillUpgradeCost(skill, count));
    if (!validCost(total) || total > points) return false;
    if (!Number.isFinite(costCeiling)) return true;
    const previous = count > 1 ? Number(bladeburner.getSkillUpgradeCost(skill, count - 1)) : 0;
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
    const skills = names.filter((name) => !unavailable.has(name)).map((name) => ({
      name,
      cost: Number(bladeburner.getSkillUpgradeCost(name, 1)),
    })).filter(({ cost }) => validCost(cost))
      .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name));
    const cheapest = skills[0];
    if (!cheapest || cheapest.cost > points) break;
    const secondCost = skills[1]?.cost ?? Infinity;
    const ceiling = Number.isFinite(secondCost) ? Math.max(secondCost, cheapest.cost * 2) : Infinity;
    let count = largestAffordableBatch(bladeburner, cheapest.name, points, ceiling);
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
  const cheapestRemaining = names.map((name) => Number(bladeburner.getSkillUpgradeCost(name, 1)))
    .filter(validCost).sort((left, right) => left - right)[0] ?? Infinity;
  return { upgrades, spent: Math.max(0, initialPoints - points), remaining: points, drained: cheapestRemaining > points };
}

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.bladeburner.inBladeburner()) return;
  const result = spendSkillPoints(ns.bladeburner);
  if (result.upgrades > 0) {
    reportInfo(ns, "bladeburner-skills", "Bladeburner-Skills verbessert", [
      `${result.upgrades} Bladeburner-Skill-Upgrades gekauft; ${ns.format.number(result.remaining)} Punkte übrig.`,
    ]);
  }
}
