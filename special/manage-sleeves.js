import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const PHASE_FILE = "/data/autoDoIt-sleeve-phase.txt";
const PHASES = Object.freeze([
  "/workers/sleeve-tasks.js",
  "/workers/sleeve-augmentations.js",
]);

/** @param {NS} ns */
export async function main(ns) {
  if (!getCapabilities(ns).sleeves) {
    reportBlocker(ns, "sleeve-api", "Sleeve-Automatisierung ist gesperrt", [
      "Die Sleeve-API benötigt BitNode 10 oder Source-File 10.",
    ], ["BitNode 10 abschließen, um Source-File 10 zu erhalten."]);
    return;
  }
  if (PHASES.some((file) => ns.scriptRunning(file, "home"))) return;
  const stored = Number(ns.read(PHASE_FILE));
  const phase = Number.isInteger(stored) && stored >= 0 && stored < PHASES.length ? stored : 0;
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `sleeve-worker-${phase}`, "Sleeve-Phase fehlt", [file]);
    return;
  }
  const required = ns.getScriptRam(file, "home");
  const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (required <= 0 || free + 0.0001 < required) {
    reportInfo(ns, `sleeve-worker-ram-${phase}`, "Sleeve-Phase wartet auf freien RAM", [
      `${ns.format.ram(required)} benötigt, ${ns.format.ram(free)} frei.`,
    ], 60_000);
    return;
  }
  if (ns.run(file, 1) === 0) return;
  ns.write(PHASE_FILE, String((phase + 1) % PHASES.length), "w");
}
