export const CRIME_GOAL = Object.freeze({
  money: "money",
  karma: "karma",
  kills: "kills",
  combat: "combat",
  balanced: "balanced",
});

function crime(name, time, money, difficulty, karma, values = {}) {
  return Object.freeze({
    name,
    stats: Object.freeze({
      type: name,
      time,
      money,
      difficulty,
      karma,
      kills: values.kills ?? 0,
      hacking_success_weight: values.hackWeight ?? 0,
      strength_success_weight: values.strWeight ?? 0,
      defense_success_weight: values.defWeight ?? 0,
      dexterity_success_weight: values.dexWeight ?? 0,
      agility_success_weight: values.agiWeight ?? 0,
      charisma_success_weight: values.chaWeight ?? 0,
      hacking_exp: values.hackExp ?? 0,
      strength_exp: values.strExp ?? 0,
      defense_exp: values.defExp ?? 0,
      dexterity_exp: values.dexExp ?? 0,
      agility_exp: values.agiExp ?? 0,
      charisma_exp: values.chaExp ?? 0,
    }),
  });
}

// Stable Bitburner v3 crime data. The live Singularity manager replaces these
// values with getCrimeStats/getCrimeChance; this table powers the pre-SF4 advisor.
export const CRIMES = Object.freeze([
  crime("Shoplift", 2_000, 15_000, 1 / 20, 0.1, { dexWeight: 1, agiWeight: 1, dexExp: 2, agiExp: 2 }),
  crime("Rob Store", 60_000, 400_000, 1 / 5, 0.5, { hackWeight: 0.5, dexWeight: 2, agiWeight: 1, hackExp: 30, dexExp: 45, agiExp: 45 }),
  crime("Mug", 4_000, 36_000, 1 / 5, 0.25, { strWeight: 1.5, defWeight: 0.5, dexWeight: 1.5, agiWeight: 0.5, strExp: 3, defExp: 3, dexExp: 3, agiExp: 3 }),
  crime("Larceny", 90_000, 800_000, 1 / 3, 1.5, { hackWeight: 0.5, dexWeight: 1, agiWeight: 1, hackExp: 45, dexExp: 60, agiExp: 60 }),
  crime("Deal Drugs", 10_000, 120_000, 1, 0.5, { chaWeight: 3, dexWeight: 2, agiWeight: 1, dexExp: 5, agiExp: 5, chaExp: 10 }),
  crime("Bond Forgery", 300_000, 4_500_000, 1 / 2, 0.1, { hackWeight: 0.05, dexWeight: 1.25, hackExp: 100, dexExp: 150, chaExp: 15 }),
  crime("Traffick Arms", 40_000, 600_000, 2, 1, { strWeight: 1, defWeight: 1, dexWeight: 1, agiWeight: 1, chaWeight: 1, strExp: 20, defExp: 20, dexExp: 20, agiExp: 20, chaExp: 40 }),
  crime("Homicide", 3_000, 45_000, 1, 3, { strWeight: 2, defWeight: 2, dexWeight: 0.5, agiWeight: 0.5, strExp: 2, defExp: 2, dexExp: 2, agiExp: 2, kills: 1 }),
  crime("Grand Theft Auto", 80_000, 1_600_000, 8, 5, { hackWeight: 1, strWeight: 1, dexWeight: 4, agiWeight: 2, chaWeight: 2, strExp: 20, defExp: 20, dexExp: 20, agiExp: 80, chaExp: 40 }),
  crime("Kidnap", 120_000, 3_600_000, 5, 6, { strWeight: 1, dexWeight: 1, agiWeight: 1, chaWeight: 1, strExp: 80, defExp: 80, dexExp: 80, agiExp: 80, chaExp: 80 }),
  crime("Assassination", 300_000, 12_000_000, 8, 10, { strWeight: 1, dexWeight: 2, agiWeight: 1, strExp: 300, defExp: 300, dexExp: 300, agiExp: 300, kills: 1 }),
  crime("Heist", 600_000, 120_000_000, 18, 15, { hackWeight: 1, strWeight: 1, defWeight: 1, dexWeight: 1, agiWeight: 1, chaWeight: 1, hackExp: 450, strExp: 450, defExp: 450, dexExp: 450, agiExp: 450, chaExp: 450 }),
]);

function clampChance(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function estimateCrimeChance(player, stats, currentNode = 1) {
  const skills = player?.skills ?? {};
  const weighted =
    Number(stats.hacking_success_weight ?? 0) * Number(skills.hacking ?? 0) +
    Number(stats.strength_success_weight ?? 0) * Number(skills.strength ?? 0) +
    Number(stats.defense_success_weight ?? 0) * Number(skills.defense ?? 0) +
    Number(stats.dexterity_success_weight ?? 0) * Number(skills.dexterity ?? 0) +
    Number(stats.agility_success_weight ?? 0) * Number(skills.agility ?? 0) +
    Number(stats.charisma_success_weight ?? 0) * Number(skills.charisma ?? 0) +
    0.025 * Number(skills.intelligence ?? 0);
  const intelligenceBonus = 1 + Math.pow(Math.max(0, Number(skills.intelligence ?? 0)), 0.8) / 600;
  const nodeMultiplier = Number(currentNode) === 14 ? 0.4 : 1;
  const crimeMultiplier = Number(player?.mults?.crime_success ?? 1);
  return clampChance(
    weighted / 975 / Math.max(Number(stats.difficulty) || 1, Number.EPSILON) *
    intelligenceBonus * nodeMultiplier * crimeMultiplier,
  );
}

function expMultiplier(player, name) {
  return Number(player?.mults?.[`${name}_exp`] ?? 1);
}

export function analyzeCrime(name, stats, chance, player, combatTarget = 100) {
  const successChance = clampChance(chance);
  const seconds = Math.max(0.001, Number(stats.time ?? 0) / 1_000);
  const failureAdjusted = successChance + (1 - successChance) * 0.25;
  const skills = player?.skills ?? {};
  const combat = [
    ["strength", "strength_exp"],
    ["defense", "defense_exp"],
    ["dexterity", "dexterity_exp"],
    ["agility", "agility_exp"],
  ];
  let combatExpPerSecond = 0;
  for (const [skill, exp] of combat) {
    const deficit = Math.max(0, Number(combatTarget) - Number(skills[skill] ?? 0));
    const needWeight = 0.05 + deficit / Math.max(1, Number(combatTarget));
    combatExpPerSecond += Number(stats[exp] ?? 0) * expMultiplier(player, skill) * failureAdjusted * needWeight / seconds;
  }
  return {
    name,
    chance: successChance,
    seconds,
    moneyPerSecond: successChance * Number(stats.money ?? 0) * Number(player?.mults?.crime_money ?? 1) / seconds,
    karmaPerSecond: failureAdjusted * Math.abs(Number(stats.karma ?? 0)) / seconds,
    killsPerSecond: successChance * Number(stats.kills ?? 0) / seconds,
    combatExpPerSecond,
  };
}

function normalized(value, maximum) {
  return maximum > 0 ? value / maximum : 0;
}

export function chooseCrime(candidates, goal = CRIME_GOAL.balanced) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const maxima = {
    money: Math.max(...candidates.map((item) => item.moneyPerSecond)),
    karma: Math.max(...candidates.map((item) => item.karmaPerSecond)),
    kills: Math.max(...candidates.map((item) => item.killsPerSecond)),
    combat: Math.max(...candidates.map((item) => item.combatExpPerSecond)),
  };
  const score = (item) => {
    if (goal === CRIME_GOAL.money) return item.moneyPerSecond;
    if (goal === CRIME_GOAL.karma) return item.karmaPerSecond;
    if (goal === CRIME_GOAL.kills) return item.killsPerSecond * 1e6 + item.karmaPerSecond;
    if (goal === CRIME_GOAL.combat) return item.combatExpPerSecond;
    return (
      normalized(item.moneyPerSecond, maxima.money) * 0.45 +
      normalized(item.combatExpPerSecond, maxima.combat) * 0.25 +
      normalized(item.karmaPerSecond, maxima.karma) * 0.20 +
      normalized(item.killsPerSecond, maxima.kills) * 0.10
    );
  };
  return [...candidates].sort((a, b) => score(b) - score(a) || b.chance - a.chance)[0];
}

export function analyzeFallbackCrimes(player, currentNode, combatTarget = 100) {
  return CRIMES.map(({ name, stats }) =>
    analyzeCrime(name, stats, estimateCrimeChance(player, stats, currentNode), player, combatTarget));
}

export function determineCrimeGoal({
  currentNode,
  gangAvailable = false,
  inGang = false,
  karma = 0,
  money = 0,
  skills = {},
  bootstrapMoney = 1_000_000,
}) {
  if (gangAvailable && !inGang && Number(karma) > -54_000) {
    return { type: CRIME_GOAL.karma, urgent: true, reason: "gang" };
  }
  const minimumCombat = Math.min(
    Number(skills.strength ?? 0),
    Number(skills.defense ?? 0),
    Number(skills.dexterity ?? 0),
    Number(skills.agility ?? 0),
  );
  if ([6, 7].includes(Number(currentNode)) && minimumCombat < 100) {
    return { type: CRIME_GOAL.combat, urgent: true, reason: "bladeburner" };
  }
  if (Number(money) < Number(bootstrapMoney)) {
    return { type: CRIME_GOAL.money, urgent: false, reason: "bootstrap-money" };
  }
  return null;
}
