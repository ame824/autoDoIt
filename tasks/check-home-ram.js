import { reportBlocker, reportInfo } from "../core/notifier.js";
import {
  homeRamUnderPressure,
  readHomeRamFocus,
  writeHomeRamPurchaseState,
} from "../lib/home-ram.js";
import { CONFIG } from "../core/config.js";
import { hasApiAccess } from "../lib/logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const reset = ns.getResetInfo();
  const focus = readHomeRamFocus(ns);
  const maximum = ns.getServerMaxRam("home");
  const ownRam = typeof ns.getScriptRam === "function"
    ? ns.getScriptRam(ns.getScriptName?.() ?? "/tasks/check-home-ram.js", "home")
    : 0;
  const used = Math.max(0, ns.getServerUsedRam("home") - ownRam);
  const fullModePressure = !focus.active && focus.target > 0 &&
    maximum >= focus.target && homeRamUnderPressure(
    maximum,
    used,
    CONFIG.fullModeHomeRamUpgradeThreshold,
  );
  if (!focus.active && !fullModePressure) {
    writeHomeRamPurchaseState(ns, "complete", reset.currentNode);
    return;
  }

  if (hasApiAccess(reset, [4], [4])) {
    const purchaseState = ["waiting", "unavailable"].includes(focus.purchaseState)
      ? focus.purchaseState
      : "automatic";
    writeHomeRamPurchaseState(ns, purchaseState, reset.currentNode);
    reportInfo(ns, "home-ram-automatic", "Home-RAM ist automatisch kaufbar", [
      fullModePressure
        ? `Home-Auslastung: ${(used / maximum * 100).toFixed(1)} %; automatische Erweiterung ab über ${(CONFIG.fullModeHomeRamUpgradeThreshold * 100).toFixed(0)} %.`
        : `Aktuell: ${ns.format.ram(focus.current)} / Ziel: ${ns.format.ram(focus.target)}`,
      fullModePressure
        ? "Der Vollbetrieb wird um eine RAM-Stufe erweitert, sobald das Budget reicht."
        : focus.ramOnly
        ? "Priorität: Home-RAM bis zur 50%-Stufe."
        : "Priorität: Home-RAM und BitNode-Abschluss gleichauf.",
    ]);
    return;
  }

  writeHomeRamPurchaseState(ns, "manual", reset.currentNode);
  reportBlocker(ns, "home-ram-manual", "Home-RAM ist nur manuell kaufbar", [
    "Der automatische Kauf benötigt BitNode 4 oder Source-File 4.",
    fullModePressure
      ? `Home-Auslastung: ${(used / maximum * 100).toFixed(1)} %; Grenze: ${(CONFIG.fullModeHomeRamUpgradeThreshold * 100).toFixed(0)} %.`
      : `Aktuell: ${ns.format.ram(focus.current)} / Ziel: ${ns.format.ram(focus.target)}`,
  ], [
    fullModePressure
      ? "Home-RAM manuell um eine Stufe erweitern."
      : `Home-RAM zunächst manuell auf mindestens ${ns.format.ram(focus.mediumAt)} erweitern.`,
  ]);
}
