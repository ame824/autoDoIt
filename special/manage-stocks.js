import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const PHASE_FILE = "/data/autoDoIt-stock-phase.txt";
const PHASES = Object.freeze(["/workers/stock-access.js", "/workers/stock-trader.js"]);

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).ramOnly) return;
  if (PHASES.some((file) => ns.scriptRunning(file, "home"))) return;
  const stored = Number(ns.read(PHASE_FILE));
  const phase = Number.isInteger(stored) && stored >= 0 && stored < PHASES.length ? stored : 0;
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `stock-worker-${phase}`, "Aktien-Phase fehlt", [file]);
    return;
  }
  const required = ns.getScriptRam(file, "home");
  const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (required <= 0 || free + 0.0001 < required) {
    reportInfo(ns, `stock-worker-ram-${phase}`, "Aktien-Phase wartet auf freien RAM", [
      `${ns.format.ram(required)} benötigt, ${ns.format.ram(free)} frei.`,
    ], 60_000);
    return;
  }
  if (ns.run(file, 1) === 0) return;
  ns.write(PHASE_FILE, String((phase + 1) % PHASES.length), "w");
}
