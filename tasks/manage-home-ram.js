import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { hasApiAccess } from "../lib/logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const focus = readHomeRamFocus(ns);
  if (!focus.active) return;

  if (!hasApiAccess(ns.getResetInfo(), [4], [4])) {
    reportBlocker(ns, "singularity-home-ram", "Home-RAM muss noch manuell erweitert werden", [
      "Der automatische RAM-Kauf benötigt Source-File 4 oder BitNode 4.",
      `RAM-Ziel für gleichzeitigen Modulbetrieb: ${ns.format.ram(focus.target)}.`,
    ], [
      `Home-RAM manuell bis ${ns.format.ram(focus.target)} erweitern.`,
    ]);
    return;
  }

  const before = ns.getServerMaxRam("home");
  let upgrades = 0;
  try {
    for (let attempt = 0; attempt < 128; attempt += 1) {
      if (ns.getServerMaxRam("home") >= focus.target) break;
      if (!ns.singularity.upgradeHomeRam()) break;
      upgrades += 1;
    }
  } catch {
    reportBlocker(ns, "singularity-home-ram-runtime", "Automatischer Home-RAM-Kauf ist noch gesperrt", [
      "Das reine RAM-Kaufmodul benötigt auf niedriger Source-File-4-Stufe selbst freien Home-RAM.",
      `RAM-Ziel: ${ns.format.ram(focus.target)}.`,
    ], [
      "Falls das Modul nicht startet, Home-RAM zunächst manuell auf mindestens 64 GiB erweitern.",
    ]);
    return;
  }

  const after = ns.getServerMaxRam("home");
  if (upgrades > 0) {
    reportSuccess(ns, `home-ram-focus-${after}`, "Home-RAM mit höchster Priorität erweitert", [
      `${upgrades} Upgrades: ${ns.format.ram(before)} → ${ns.format.ram(after)}`,
      `Ziel für alle Module gleichzeitig: ${ns.format.ram(focus.target)}.`,
    ]);
    return;
  }

  reportInfo(ns, "home-ram-focus-saving", "autoDoIt spart auf Home-RAM", [
    `Aktuell: ${ns.format.ram(after)} / Ziel: ${ns.format.ram(focus.target)}`,
    "Optionale Käufe sind bis zum RAM-Ziel pausiert.",
  ]);
}
