export const GANG_REPUTATION_GOAL_FILE = "/data/gang-reputation-goal.txt";
export const GANG_REPUTATION_GOAL_TTL_MS = 2 * 60_000;
export const GANG_MEMBER_LIMIT = 12;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createGangReputationGoal(target, gangFaction, now = Date.now()) {
  if (target?.neuroFluxStage) return null;
  if (!target || String(target.faction) !== String(gangFaction)) return null;
  const requirement = finiteNumber(target.requirement);
  const factionRep = finiteNumber(target.factionRep);
  if (!target.augmentation || requirement <= factionRep) return null;
  return {
    faction: String(gangFaction),
    augmentation: String(target.augmentation),
    requirement,
    factionRep,
    updatedAt: finiteNumber(now),
  };
}

export function parseGangReputationGoal(raw, gangFaction, now = Date.now()) {
  let goal;
  try {
    goal = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!goal || typeof goal !== "object") return null;
  if (String(goal.faction) !== String(gangFaction)) return null;
  const updatedAt = finiteNumber(goal.updatedAt, -Infinity);
  if (updatedAt > now + 60_000 || now - updatedAt > GANG_REPUTATION_GOAL_TTL_MS) return null;
  return createGangReputationGoal(goal, gangFaction, updatedAt);
}

export function gangMemberPrimaryStat(member, isHacking) {
  if (isHacking) return finiteNumber(member?.hack);
  return (
    finiteNumber(member?.str) +
    finiteNumber(member?.def) +
    finiteNumber(member?.dex) +
    finiteNumber(member?.agi)
  ) / 4;
}

export function wantedWorkerCount(gang, productiveCount) {
  if (productiveCount <= 1) return 0;
  const penalty = finiteNumber(gang?.wantedPenalty, 1);
  const wantedGain = finiteNumber(gang?.wantedLevelGainRate);
  let ratio = 0;
  if (penalty < 0.50) ratio = 0.75;
  else if (penalty < 0.80) ratio = 0.50;
  else if (penalty < 0.90) ratio = 0.34;
  else if (penalty < 0.95) ratio = 0.25;
  else if (penalty < 0.98) ratio = 0.15;
  else if (penalty < 0.995 && wantedGain > 0) ratio = 0.10;
  return Math.min(productiveCount - 1, Math.max(0, Math.ceil(productiveCount * ratio)));
}

export function chooseGangTaskPlan({
  gang,
  members,
  reputationGoal = null,
  trainingThreshold = 250,
}) {
  const described = members.map((member) => ({
    name: String(member.name),
    primary: gangMemberPrimaryStat(member, Boolean(gang.isHacking)),
  }));
  const training = described.filter(({ primary }) => primary < trainingThreshold);
  const productive = described
    .filter(({ primary }) => primary >= trainingThreshold)
    .sort((left, right) => left.primary - right.primary || left.name.localeCompare(right.name));
  const nextRecruit = finiteNumber(gang.respectForNextRecruit, Infinity);
  const recruiting = described.length < GANG_MEMBER_LIMIT && finiteNumber(gang.respect) < nextRecruit;
  const reputation = Boolean(reputationGoal);
  const respectMode = recruiting || reputation;
  const justiceCount = wantedWorkerCount(gang, productive.length);
  const justice = new Set(productive.slice(0, justiceCount).map(({ name }) => name));
  const trainingNames = new Set(training.map(({ name }) => name));

  const taskFor = (name) => {
    if (trainingNames.has(name)) return "training";
    if (justice.has(name)) return "wanted";
    return respectMode ? "respect" : "money";
  };
  const assignments = described.map(({ name }) => ({ name, role: taskFor(name) }));
  return {
    assignments,
    recruiting,
    reputation,
    trainingCount: training.length,
    wantedCount: justice.size,
    respectCount: assignments.filter(({ role }) => role === "respect").length,
    moneyCount: assignments.filter(({ role }) => role === "money").length,
    allowAscension: described.length >= GANG_MEMBER_LIMIT || !recruiting,
  };
}
