import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import {
  chooseCheapestFactionAugmentation,
  chooseNeuroFluxFaction,
  collectFactionAugmentationOptions,
} from "../lib/faction-augmentations.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

export const DARKNET_LABYRINTH_AUGMENTATIONS = Object.freeze([
  "The Broken Wings",
  "The Boots",
  "The Hammer",
  "The Staff",
  "The Law",
  "The Sword",
  "The Red Pill",
]);

const DARKNET_LABYRINTH_AUGMENTATION_SET = new Set(DARKNET_LABYRINTH_AUGMENTATIONS);

export function queuedAugmentations(installed, installedAndQueued) {
  const installedCounts = new Map();
  for (const name of installed ?? []) {
    installedCounts.set(name, Number(installedCounts.get(name) ?? 0) + 1);
  }

  return [...(installedAndQueued ?? [])].filter((name) => {
    const remainingInstalled = Number(installedCounts.get(name) ?? 0);
    if (remainingInstalled <= 0) return true;
    installedCounts.set(name, remainingInstalled - 1);
    return false;
  });
}

export function requiresImmediateAugmentationInstall(_currentNode, purchased) {
  const queued = purchased ?? [];
  return queued.some((name) => DARKNET_LABYRINTH_AUGMENTATION_SET.has(name));
}

function installAugmentations(ns, purchased, reason) {
  reportInfo(ns, "installing-augs", "Augmentierungen werden installiert", [
    `${purchased.length} neue Augmentierungen.`,
    reason,
    "autoDoIt startet nach dem Reset automatisch erneut.",
  ], 10_000);
  ns.singularity.installAugmentations("/autoDoIt.js");
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-augs", "Augmentierungen können noch nicht automatisch verwaltet werden", [
      "Kauf und Installation benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Augmentierungen vorläufig manuell kaufen und installieren.",
    ]);
    return;
  }

  const installedNamesBefore = ns.singularity.getOwnedAugmentations(false);
  const installedBefore = new Set(installedNamesBefore);
  const allOwnedBefore = ns.singularity.getOwnedAugmentations(true);
  const purchasedBefore = queuedAugmentations(installedNamesBefore, allOwnedBefore);
  if (
    requiresImmediateAugmentationInstall(
      capabilities.reset.currentNode,
      purchasedBefore,
    )
  ) {
    installAugmentations(
      ns,
      purchasedBefore,
      purchasedBefore.includes("The Red Pill")
        ? "The Red Pill hat für den BitNode-Abschluss Vorrang."
        : "Der nächste Darknet-Labyrinthabschnitt wird dadurch sofort freigeschaltet.",
    );
    return;
  }

  const homeFocus = readHomeRamFocus(ns);
  if (homeFocus.ramOnly) {
    reportInfo(ns, "augmentations-wait-for-home-ram", "Augmentierungen warten auf das Home-RAM-Ziel", [
      `Home-RAM: ${ns.format.ram(homeFocus.current)} / ${ns.format.ram(homeFocus.target)}`,
      "Käufe und normale Installations-Resets sind vorübergehend pausiert.",
    ]);
    return;
  }

  const factions = ns.getPlayer().factions ?? [];
  const ownedBefore = new Set(allOwnedBefore);
  const specificOptions = collectFactionAugmentationOptions(ns, factions, ownedBefore);
  const option = chooseCheapestFactionAugmentation(specificOptions);

  if (option) {
    const money = ns.getPlayer().money;
    if (
      money - CONFIG.augmentationMoneyReserve >= option.price &&
      option.factionRep >= option.requirement &&
      ns.singularity.purchaseAugmentation(option.faction, option.name)
    ) {
      reportSuccess(ns, `aug-${option.name}`, `Augmentierung gekauft: ${option.name}`, [
        `Fraktion: ${option.faction}`,
      ]);
      return;
    }
  }

  if (specificOptions.length === 0) {
    const neuroFlux = chooseNeuroFluxFaction(
      collectFactionAugmentationOptions(ns, factions, ownedBefore, true),
    );
    const money = ns.getPlayer().money;
    if (
      neuroFlux &&
      money - CONFIG.augmentationMoneyReserve >= neuroFlux.price &&
      neuroFlux.factionRep >= neuroFlux.requirement &&
      ns.singularity.purchaseAugmentation(neuroFlux.faction, neuroFlux.name)
    ) {
      reportSuccess(ns, `aug-neuroflux-${Date.now()}`, `Augmentierung gekauft: ${neuroFlux.name}`, [
        `Fraktion: ${neuroFlux.faction}`,
        "Alle verfügbaren fraktionsspezifischen Augmentierungen sind bereits abgeschlossen.",
      ]);
    }
  }

  const installedNames = ns.singularity.getOwnedAugmentations(false);
  const allOwned = ns.singularity.getOwnedAugmentations(true);
  const purchased = queuedAugmentations(installedNames, allOwned);

  if (purchased.length >= CONFIG.minimumAugsBeforeInstall) {
    installAugmentations(
      ns,
      purchased,
      "Die konfigurierte Augmentierungsmenge wurde erreicht.",
    );
    return;
  }

  if (purchased.length > 0) {
    reportInfo(ns, "augs-batching", "Augmentierungen werden gesammelt", [
      `${purchased.length}/${CONFIG.minimumAugsBeforeInstall} für den nächsten Installations-Reset.`,
    ]);
  }
}
