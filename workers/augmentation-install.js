import { CONFIG } from "../core/config.js";
import { reportInfo } from "../core/notifier.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { queuedAugmentations, requiresImmediateAugmentationInstall } from "../lib/augmentation-logic.js";
import { adaptiveAugmentationThreshold } from "../lib/node-rush.js";

function elapsedReset(value, now) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1_000_000_000_000 ? Math.max(0, now - numeric) : numeric;
}

function install(ns, purchased, reason) {
  reportInfo(ns, "installing-augs", "Augmentierungen werden installiert", [
    `${purchased.length} neue Augmentierungen.`, reason,
    "autoDoIt startet nach dem Reset automatisch erneut.",
  ], 10_000);
  ns.singularity.installAugmentations("/autoDoIt.js");
}

/** @param {NS} ns */
export async function main(ns) {
  const installed = ns.singularity.getOwnedAugmentations(false);
  const allOwned = ns.singularity.getOwnedAugmentations(true);
  const purchased = queuedAugmentations(installed, allOwned);
  if (requiresImmediateAugmentationInstall(0, purchased)) {
    install(ns, purchased, purchased.includes("The Red Pill")
      ? "The Red Pill hat für den BitNode-Abschluss Vorrang."
      : "Der nächste Darknet-Labyrinthabschnitt wird dadurch sofort freigeschaltet.");
    return;
  }
  const focus = readHomeRamFocus(ns);
  if (focus.ramOnly) {
    reportInfo(ns, "augmentations-wait-for-home-ram", "Augmentierungen warten auf das Home-RAM-Ziel", [
      `Home-RAM: ${ns.format.ram(focus.current)} / ${ns.format.ram(focus.target)}`,
      "Käufe und normale Installations-Resets sind vorübergehend pausiert.",
    ]);
    return;
  }
  const now = Date.now();
  const reset = ns.getResetInfo();
  const threshold = adaptiveAugmentationThreshold({
    baseThreshold: CONFIG.minimumAugsBeforeInstall,
    elapsedSinceAugReset: elapsedReset(reset.lastAugReset, now),
    elapsedSinceNodeReset: elapsedReset(reset.lastNodeReset, now),
    currentNode: reset.currentNode,
    installedCount: installed.length,
    quickWindowMs: CONFIG.augmentationQuickInstallWindowMs,
    quickThreshold: CONFIG.augmentationQuickInstallThreshold,
    decayIntervalMs: CONFIG.augmentationThresholdDecayMs,
    minimumThreshold: CONFIG.augmentationMinimumAdaptiveThreshold,
    patientNodeWindowMs: CONFIG.augmentationPatientNodeWindowMs,
  });
  if (purchased.length >= threshold) {
    install(ns, purchased, "Die konfigurierte Augmentierungsmenge wurde erreicht.");
  } else if (purchased.length > 0) {
    reportInfo(ns, "augs-batching", "Augmentierungen werden gesammelt", [
      `${purchased.length}/${threshold} für den nächsten adaptiven Installations-Reset.`,
    ]);
  }
}
