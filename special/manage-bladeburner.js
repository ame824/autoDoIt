import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const PHASE_FILE = "/data/autoDoIt-bladeburner-phase.txt";
const PHASES = Object.freeze([
  "/workers/bladeburner-bootstrap.js",
  "/workers/bladeburner-skills.js",
  "/workers/bladeburner-action.js",
]);

/** @param {NS} ns */
export async function main(ns) {
  if (!getCapabilities(ns).bladeburner) {
    reportBlocker(ns, "bladeburner-api", "Bladeburner-Automatisierung ist gesperrt", [
      "Die API benötigt BitNode 6/7 oder Source-File 6/7.",
    ], ["Ein entsprechendes BitNode abschließen."]);
    return;
  }
  if (PHASES.some((file) => ns.scriptRunning(file, "home"))) return;
  const stored = Number(ns.read(PHASE_FILE));
  const phase = Number.isInteger(stored) && stored >= 0 && stored < PHASES.length ? stored : 0;
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `bladeburner-worker-${phase}`, "Bladeburner-Phase fehlt", [file]);
    return;
  }
  const required = ns.getScriptRam(file, "home");
  const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (required <= 0 || free + 0.0001 < required) {
    reportInfo(ns, `bladeburner-worker-ram-${phase}`, "Bladeburner-Phase wartet auf freien RAM", [
      `${ns.format.ram(required)} benötigt, ${ns.format.ram(free)} frei.`,
    ], 60_000);
    return;
  }
  if (ns.run(file, 1) === 0) return;
  ns.write(PHASE_FILE, String((phase + 1) % PHASES.length), "w");
}
