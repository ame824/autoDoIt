import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";
import { getIndustryStartingCost, nextCorporationPhase } from "../lib/corporation-logic.js";

export { getIndustryStartingCost };

const PHASE_FILE = "/data/autoDoIt-corporation-phase.txt";
const PHASES = Object.freeze([
  "/workers/corporation-bootstrap.js",
  "/workers/corporation-expansion.js",
  "/workers/corporation-supply.js",
  "/workers/corporation-offices.js",
  "/workers/corporation-wellness.js",
  "/workers/corporation-capital.js",
  "/workers/corporation-growth.js",
  "/workers/corporation-materials.js",
  "/workers/corporation-research.js",
  "/workers/corporation-products.js",
  "/workers/corporation-sales.js",
]);

function readPhase(ns) {
  const value = Number(ns.read(PHASE_FILE));
  return Number.isInteger(value) && value >= 0 && value < PHASES.length ? value : 0;
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.corporation) {
    reportBlocker(ns, "corporation-api", "Corporation-Automatisierung ist gesperrt", [
      "Die Corporation-API benötigt BitNode 3 oder Source-File 3.",
    ], [
      "BitNode 3 abschließen, um Source-File 3 zu erhalten.",
    ]);
    return;
  }

  const running = PHASES.find((file) => ns.scriptRunning(file, "home"));
  if (running) return;

  const phase = ns.corporation.hasCorporation() ? readPhase(ns) : 0;
  const file = PHASES[phase];
  if (!ns.fileExists(file, "home")) {
    reportBlocker(ns, `corporation-worker-${phase}`, "Corporation-Phase fehlt", [file], [
      "git-pull.js ausführen, damit alle Corporation-Dateien geladen werden.",
    ]);
    return;
  }

  const requiredRam = ns.getScriptRam(file, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (requiredRam <= 0 || freeRam + 0.0001 < requiredRam) {
    reportInfo(ns, `corporation-worker-ram-${phase}`, "Corporation-Phase wartet auf freien RAM", [
      `${ns.format.ram(requiredRam)} benötigt, ${ns.format.ram(freeRam)} frei.`,
    ], 60_000);
    return;
  }

  const pid = ns.run(file, 1);
  if (pid === 0) return;
  ns.write(PHASE_FILE, String(nextCorporationPhase(phase, PHASES.length)), "w");
  reportInfo(ns, "corporation-active", "Corporation wird phasenweise verwaltet", [
    `${file.replace("/workers/corporation-", "").replace(".js", "")} · ${ns.format.ram(requiredRam)}`,
  ], 60_000);
}
