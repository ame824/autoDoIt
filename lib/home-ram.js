export const HOME_RAM_FOCUS_FILE = "/data/autoDoIt-home-ram-focus.txt";

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

export function fullOperationRamTarget(ns, files, config) {
  const uniqueFiles = new Set(files);
  const ramValues = [...uniqueFiles].map((file) => ns.getScriptRam(file, "home"));
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
    return {
      active: Boolean(state.active) && Number.isFinite(target) && current < target,
      target: Number.isFinite(target) ? target : 0,
      current: Number.isFinite(current) ? current : 0,
    };
  } catch {
    return { active: false, target: 0, current: 0 };
  }
}

export function writeHomeRamFocus(ns, current, target) {
  const state = {
    active: Number(current) < Number(target),
    current: Number(current),
    target: Number(target),
  };
  ns.write(HOME_RAM_FOCUS_FILE, JSON.stringify(state), "w");
  return state;
}
