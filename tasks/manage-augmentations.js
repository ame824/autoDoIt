import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const PHASE_FILE = "/data/autoDoIt-augmentation-phase.txt";
const PHASES = Object.freeze([
  "/workers/augmentation-purchase.js",
  "/workers/augmentation-install.js",
]);

/** @param {NS} ns */
export async function main(ns) {
  if (!getCapabilities(ns).singularity) {
    reportBlocker(ns, "singularity-augs", "Augmentierungen können noch nicht automatisch verwaltet werden", [
      "Kauf und Installation benötigen Source-File 4 oder BitNode 4.",
    ], ["Augmentierungen vorläufig manuell kaufen und installieren."]);
    return;
  }
  if (PHASES.some((file) => ns.scriptRunning(file, "home"))) return;
  const stored = Number(ns.read(PHASE_FILE));
  const phase = Number.isInteger(stored) && stored >= 0 && stored < PHASES.length ? stored : 0;
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `augmentation-worker-${phase}`, "Augmentierungsphase fehlt", [file]);
    return;
  }
  const required = ns.getScriptRam(file, "home");
  const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (required <= 0 || free + 0.0001 < required) {
    reportInfo(ns, `augmentation-worker-ram-${phase}`, "Augmentierungsphase wartet auf freien RAM", [
      `${ns.format.ram(required)} benötigt, ${ns.format.ram(free)} frei.`,
    ], 60_000);
    return;
  }
  if (ns.run(file, 1) === 0) return;
  ns.write(PHASE_FILE, String((phase + 1) % PHASES.length), "w");
}
