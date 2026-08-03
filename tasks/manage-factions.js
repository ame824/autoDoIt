import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const PHASE_FILE = "/data/autoDoIt-faction-phase.txt";
const PHASES = Object.freeze([
  "/workers/faction-invitations.js",
  "/workers/faction-planner.js",
  "/workers/faction-work.js",
]);

/** @param {NS} ns */
export async function main(ns) {
  if (!getCapabilities(ns).singularity) {
    reportBlocker(ns, "singularity-factions", "Fraktionen benötigen noch manuelle Bedienung", [
      "Einladungen, Fraktionsarbeit und Anforderungen benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Fraktionseinladungen manuell prüfen und sinnvolle Fraktionen beitreten.",
      "Für benötigte Augmentierungen manuell Fraktionsreputation sammeln.",
    ]);
    return;
  }
  if (PHASES.some((file) => ns.scriptRunning(file, "home"))) return;
  const stored = Number(ns.read(PHASE_FILE));
  const phase = Number.isInteger(stored) && stored >= 0 && stored < PHASES.length ? stored : 0;
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `faction-worker-${phase}`, "Fraktionsphase fehlt", [file]);
    return;
  }
  const required = ns.getScriptRam(file, "home");
  const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (required <= 0 || free + 0.0001 < required) {
    reportInfo(ns, `faction-worker-ram-${phase}`, "Fraktionsphase wartet auf freien RAM", [
      `${ns.format.ram(required)} benötigt, ${ns.format.ram(free)} frei.`,
    ], 60_000);
    return;
  }
  if (ns.run(file, 1) === 0) return;
  ns.write(PHASE_FILE, String((phase + 1) % PHASES.length), "w");
}
