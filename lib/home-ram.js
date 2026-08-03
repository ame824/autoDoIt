export const HOME_RAM_FOCUS_FILE = "/data/autoDoIt-home-ram-focus.txt";
export const HOME_RAM_PHASE = Object.freeze({
  ram: "ram",
  balanced: "balanced",
  complete: "complete",
});

export function nextPowerOfTwo(value) {
  const required = Math.max(1, Math.ceil(Number(value) || 0));
  return 2 ** Math.ceil(Math.log2(required));
}

export function calculateConcurrentRamTarget(
  ramValues,
  minimumTarget,
  reserveFraction = 0.10,
  minimumReserve = 32,
) {
  const moduleRam = [...ramValues]
    .map(Number)
    .filter((ram) => Number.isFinite(ram) && ram > 0)
    .reduce((sum, ram) => sum + ram, 0);
  const reserve = Math.max(
    Number(minimumReserve) || 0,
    moduleRam * Math.max(0, Number(reserveFraction) || 0),
  );
  return Math.max(
    Number(minimumTarget) || 0,
    nextPowerOfTwo(moduleRam + reserve),
  );
}

export function fullOperationRamTarget(ns, files, config, phaseWorkerGroups = []) {
  const uniqueFiles = new Set(files);
  const ramValues = [...uniqueFiles].map((file) => ns.getScriptRam(file, "home"));
  for (const group of phaseWorkerGroups) {
    const maximum = Math.max(0, ...group.map((file) => Number(ns.getScriptRam(file, "home")) || 0));
    if (maximum > 0) ramValues.push(maximum);
  }
  return calculateConcurrentRamTarget(
    ramValues,
    config.fullModeHomeRam,
    config.homeRamFocusReserveFraction,
    config.homeRamFocusMinimumReserve,
  );
}

export function readHomeRamFocus(ns) {
  try {
    const state = JSON.parse(String(ns.read(HOME_RAM_FOCUS_FILE)));
    const target = Number(state.target);
    const current = Number(state.current);
    const mediumAt = Number(state.mediumAt || target * 0.5);
    const active = Boolean(state.active) && Number.isFinite(target) && current < target;
    const phase = active
      ? current < mediumAt ? HOME_RAM_PHASE.ram : HOME_RAM_PHASE.balanced
      : HOME_RAM_PHASE.complete;
    return {
      active,
      ramOnly: phase === HOME_RAM_PHASE.ram,
      phase,
      target: Number.isFinite(target) ? target : 0,
      current: Number.isFinite(current) ? current : 0,
      mediumAt: Number.isFinite(mediumAt) ? mediumAt : 0,
      purchaseState: String(state.purchaseState ?? "unknown"),
      currentNode: Number(state.currentNode ?? 0),
    };
  } catch {
    return {
      active: false,
      ramOnly: false,
      phase: HOME_RAM_PHASE.complete,
      target: 0,
      current: 0,
      mediumAt: 0,
      purchaseState: "unknown",
      currentNode: 0,
    };
  }
}

function readRawState(ns) {
  try {
    return JSON.parse(String(ns.read(HOME_RAM_FOCUS_FILE))) ?? {};
  } catch {
    return {};
  }
}

export function writeHomeRamFocus(ns, current, target, mediumRatio = 0.5) {
  const previous = readRawState(ns);
  const mediumAt = Number(target) * Number(mediumRatio);
  const state = {
    ...previous,
    active: Number(current) < Number(target),
    current: Number(current),
    target: Number(target),
    mediumAt,
    purchaseState: Number(current) >= Number(target)
      ? "complete"
      : String(previous.purchaseState ?? "unknown"),
  };
  ns.write(HOME_RAM_FOCUS_FILE, JSON.stringify(state), "w");
  return state;
}

export function writeHomeRamPurchaseState(ns, purchaseState, currentNode = 0) {
  const state = {
    ...readRawState(ns),
    purchaseState: String(purchaseState),
    currentNode: Number(currentNode),
  };
  ns.write(HOME_RAM_FOCUS_FILE, JSON.stringify(state), "w");
  return state;
}
