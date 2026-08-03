export const NODE_RUSH_STATE_FILE = "/data/autoDoIt-node-rush.txt";
export const NODE_RUSH_STATE_TTL_MS = 30_000;

const EMPTY_REQUIREMENTS = Object.freeze({ money: 0, hacking: 0, augmentations: 0 });

function mergeRequirements(left, right) {
  return {
    money: Math.max(Number(left?.money) || 0, Number(right?.money) || 0),
    hacking: Math.max(Number(left?.hacking) || 0, Number(right?.hacking) || 0),
    augmentations: Math.max(
      Number(left?.augmentations) || 0,
      Number(right?.augmentations) || 0,
    ),
  };
}

function requirementCandidate(requirement) {
  if (!requirement || typeof requirement !== "object") return { ...EMPTY_REQUIREMENTS };
  if (requirement.type === "money") {
    return { ...EMPTY_REQUIREMENTS, money: Math.max(0, Number(requirement.money) || 0) };
  }
  if (requirement.type === "numAugmentations") {
    return {
      ...EMPTY_REQUIREMENTS,
      augmentations: Math.max(0, Number(requirement.numAugmentations) || 0),
    };
  }
  if (requirement.type === "skills") {
    return {
      ...EMPTY_REQUIREMENTS,
      hacking: Math.max(0, Number(requirement.skills?.hacking) || 0),
    };
  }

  const children = requirement.conditions ?? requirement.requirements ?? [];
  if (!Array.isArray(children) || children.length === 0) return { ...EMPTY_REQUIREMENTS };
  const candidates = children.map(requirementCandidate);
  if (requirement.type === "someCondition") {
    // autoDoIt is a hacking-first system. Prefer the hacking path when an API
    // requirement offers alternatives such as hacking or combat skills.
    return [...candidates].sort((left, right) => {
      const leftHacking = left.hacking > 0 ? 0 : 1;
      const rightHacking = right.hacking > 0 ? 0 : 1;
      return leftHacking - rightHacking || left.hacking - right.hacking;
    })[0] ?? { ...EMPTY_REQUIREMENTS };
  }
  return candidates.reduce(mergeRequirements, { ...EMPTY_REQUIREMENTS });
}

export function extractCriticalRequirements(requirements) {
  const list = Array.isArray(requirements) ? requirements : [requirements];
  return list.reduce(
    (result, requirement) => mergeRequirements(result, requirementCandidate(requirement)),
    { ...EMPTY_REQUIREMENTS },
  );
}

export function createNodeRushState({
  now = Date.now(),
  currentNode = 1,
  playerMoney = 0,
  hackingLevel = 0,
  installedAugmentations = 0,
  joinedDaedalus = false,
  hasRedPill = false,
  daedalusRequirements = EMPTY_REQUIREMENTS,
  worldDaemonRequiredLevel = Infinity,
  xpSprintRatio = 0.75,
} = {}) {
  const base = {
    updatedAt: Number(now),
    currentNode: Number(currentNode),
    stage: "augmentations",
    reserveMoney: 0,
    xpOnly: false,
    targetHacking: 0,
  };
  if (Number(currentNode) === 15 && !hasRedPill) return { ...base, stage: "labyrinth" };

  if (hasRedPill) {
    const target = Number(worldDaemonRequiredLevel);
    const train = Number.isFinite(target) && Number(hackingLevel) < target;
    return {
      ...base,
      stage: train ? "world-daemon-hacking" : "world-daemon",
      xpOnly: train && Number(hackingLevel) >= target * Number(xpSprintRatio),
      targetHacking: Number.isFinite(target) ? target : 0,
    };
  }

  if (joinedDaedalus) return { ...base, stage: "red-pill" };

  const requirements = mergeRequirements(EMPTY_REQUIREMENTS, daedalusRequirements);
  if (requirements.money <= 0 && requirements.hacking <= 0 && requirements.augmentations <= 0) {
    return base;
  }
  if (Number(installedAugmentations) < requirements.augmentations) return base;

  const reserveMoney = requirements.money;
  if (Number(playerMoney) < requirements.money) {
    return { ...base, stage: "daedalus-money", reserveMoney };
  }
  if (Number(hackingLevel) < requirements.hacking) {
    return {
      ...base,
      stage: "daedalus-hacking",
      reserveMoney,
      xpOnly: Number(hackingLevel) >= requirements.hacking * Number(xpSprintRatio),
      targetHacking: requirements.hacking,
    };
  }
  return { ...base, stage: "daedalus-invite", reserveMoney };
}

export function parseNodeRushState(raw, now = Date.now()) {
  let state;
  try { state = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
  if (!state || typeof state !== "object") return null;
  const updatedAt = Number(state.updatedAt);
  if (
    !Number.isFinite(updatedAt) || updatedAt > now + 60_000 ||
    now - updatedAt > NODE_RUSH_STATE_TTL_MS
  ) return null;
  return {
    updatedAt,
    currentNode: Number(state.currentNode) || 1,
    stage: String(state.stage || "augmentations"),
    reserveMoney: Math.max(0, Number(state.reserveMoney) || 0),
    xpOnly: Boolean(state.xpOnly),
    targetHacking: Math.max(0, Number(state.targetHacking) || 0),
  };
}

export function readNodeRushState(ns, now = Date.now()) {
  return parseNodeRushState(ns.read(NODE_RUSH_STATE_FILE), now);
}

export function writeNodeRushState(ns, state) {
  ns.write(NODE_RUSH_STATE_FILE, JSON.stringify(state), "w");
  return state;
}

export function spendableMoney(money, state) {
  return Math.max(0, Number(money) - Math.max(0, Number(state?.reserveMoney) || 0));
}

export function adaptiveAugmentationThreshold({
  baseThreshold = 5,
  elapsedSinceAugReset = 0,
  elapsedSinceNodeReset = 0,
  currentNode = 1,
  installedCount = 0,
  quickWindowMs = 20 * 60_000,
  quickThreshold = 4,
  decayIntervalMs = 90 * 60_000,
  minimumThreshold = 2,
  patientNodeWindowMs = 2 * 60 * 60_000,
} = {}) {
  const base = Math.max(1, Math.floor(Number(baseThreshold) || 1));
  const nodeElapsed = Number(elapsedSinceNodeReset);
  const patientNode = Number.isFinite(nodeElapsed) && nodeElapsed <= Number(patientNodeWindowMs);
  if (patientNode && (
    Number(currentNode) === 8 || (Number(currentNode) === 9 && Number(installedCount) === 0)
  )) {
    return base + 2;
  }
  if (Number.isFinite(nodeElapsed) && nodeElapsed <= Number(quickWindowMs)) {
    return Math.max(minimumThreshold, Math.min(base, Number(quickThreshold) || base));
  }
  const augElapsed = Number(elapsedSinceAugReset);
  const decay = Number.isFinite(augElapsed)
    ? Math.floor(Math.max(0, augElapsed) / Math.max(1, Number(decayIntervalMs)))
    : 0;
  return Math.max(Number(minimumThreshold) || 1, base - decay);
}

export function chooseCriticalAugmentation(options, names = ["The Red Pill"]) {
  const priorities = new Map(names.map((name, index) => [name, index]));
  return [...(options ?? [])]
    .filter(({ name, prerequisitesMet }) => priorities.has(name) && prerequisitesMet)
    .sort((left, right) =>
      priorities.get(left.name) - priorities.get(right.name) ||
      left.gap - right.gap ||
      left.price - right.price
    )[0] ?? null;
}
