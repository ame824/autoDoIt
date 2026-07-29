import { reportBlocker, reportInfo } from "../core/notifier.js";
import {
  readHomeRamFocus,
  writeHomeRamPurchaseState,
} from "../lib/home-ram.js";
import { hasApiAccess } from "../lib/logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const reset = ns.getResetInfo();
  const focus = readHomeRamFocus(ns);
  if (!focus.active) {
    writeHomeRamPurchaseState(ns, "complete", reset.currentNode);
    return;
  }

  if (hasApiAccess(reset, [4], [4])) {
    const purchaseState = ["waiting", "unavailable"].includes(focus.purchaseState)
      ? focus.purchaseState
      : "automatic";
    writeHomeRamPurchaseState(ns, purchaseState, reset.currentNode);
    reportInfo(ns, "home-ram-automatic", "Home-RAM ist automatisch kaufbar", [
      `Aktuell: ${ns.format.ram(focus.current)} / Ziel: ${ns.format.ram(focus.target)}`,
      focus.ramOnly
        ? "Priorität: Home-RAM bis zur 50%-Stufe."
        : "Priorität: Home-RAM und BitNode-Abschluss gleichauf.",
    ]);
    return;
  }

  writeHomeRamPurchaseState(ns, "manual", reset.currentNode);
  reportBlocker(ns, "home-ram-manual", "Home-RAM ist nur manuell kaufbar", [
    "Der automatische Kauf benötigt BitNode 4 oder Source-File 4.",
    `Aktuell: ${ns.format.ram(focus.current)} / Ziel: ${ns.format.ram(focus.target)}`,
  ], [
    `Home-RAM zunächst manuell auf mindestens ${ns.format.ram(focus.mediumAt)} erweitern.`,
  ]);
}
