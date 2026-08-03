import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const PHASE_FILE = "/data/autoDoIt-gang-phase.txt";
const PHASES = Object.freeze([
  "/workers/gang-bootstrap.js",
  "/workers/gang-assignments.js",
  "/workers/gang-equipment.js",
  "/workers/gang-territory.js",
]);

function readPhase(ns) {
  const value = Number(ns.read(PHASE_FILE));
  return Number.isInteger(value) && value >= 0 && value < PHASES.length ? value : 0;
}

/** @param {NS} ns */
export async function main(ns) {
  if (!getCapabilities(ns).gang) {
    reportBlocker(ns, "gang-api", "Gang-Automatisierung ist gesperrt", [
      "Die Gang-API benötigt BitNode 2 oder Source-File 2.",
    ], [
      "BitNode 2 abschließen, um Source-File 2 zu erhalten.",
    ]);
    return;
  }

  if (PHASES.some((file) => ns.scriptRunning(file, "home"))) return;
  const phase = readPhase(ns);
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `gang-worker-${phase}`, "Gang-Phase fehlt", [file], [
      "git-pull.js ausführen, damit alle Gang-Dateien geladen werden.",
    ]);
    return;
  }

  const requiredRam = ns.getScriptRam(file, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (requiredRam <= 0 || freeRam + 0.0001 < requiredRam) {
    reportInfo(ns, `gang-worker-ram-${phase}`, "Gang-Phase wartet auf freien RAM", [
      `${ns.format.ram(requiredRam)} benötigt, ${ns.format.ram(freeRam)} frei.`,
    ], 60_000);
    return;
  }

  const pid = ns.run(file, 1);
  if (pid === 0) return;
  ns.write(PHASE_FILE, String((phase + 1) % PHASES.length), "w");
  reportInfo(ns, "gang-active", "Gang wird phasenweise verwaltet", [
    `${file.replace("/workers/gang-", "").replace(".js", "")} · ${ns.format.ram(requiredRam)}`,
  ], 60_000);
}
