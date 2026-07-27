import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

function purchasableAugmentations(ns, factions, owned) {
  const options = new Map();
  for (const faction of factions) {
    for (const name of ns.singularity.getAugmentationsFromFaction(faction)) {
      if (name === "NeuroFlux Governor" || owned.has(name)) continue;
      const price = ns.singularity.getAugmentationPrice(name);
      const rep = ns.singularity.getAugmentationRepReq(name);
      const prereqs = ns.singularity.getAugmentationPrereq(name);
      if (!prereqs.every((prereq) => owned.has(prereq))) continue;
      const option = { name, faction, price, rep };
      const previous = options.get(name);
      if (!previous || option.price < previous.price) options.set(name, option);
    }
  }
  return [...options.values()].sort((a, b) => a.price - b.price);
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

  const factions = ns.getPlayer().factions ?? [];
  const ownedBefore = new Set(ns.singularity.getOwnedAugmentations(true));
  const options = purchasableAugmentations(ns, factions, ownedBefore);

  for (const option of options) {
    const money = ns.getPlayer().money;
    if (money - CONFIG.augmentationMoneyReserve < option.price) continue;
    if (ns.singularity.getFactionRep(option.faction) < option.rep) continue;
    if (ns.singularity.purchaseAugmentation(option.faction, option.name)) {
      reportSuccess(ns, `aug-${option.name}`, `Augmentierung gekauft: ${option.name}`, [
        `Fraktion: ${option.faction}`,
      ]);
      return;
    }
  }

  const installed = new Set(ns.singularity.getOwnedAugmentations(false));
  const allOwned = ns.singularity.getOwnedAugmentations(true);
  const purchased = allOwned.filter((name) => !installed.has(name));
  const mustInstall = purchased.includes("The Red Pill");

  if (purchased.length >= CONFIG.minimumAugsBeforeInstall || mustInstall) {
    reportInfo(ns, "installing-augs", "Augmentierungen werden installiert", [
      `${purchased.length} neue Augmentierungen.`,
      "autoDoIt startet nach dem Reset automatisch erneut.",
    ], 10_000);
    ns.singularity.installAugmentations("/autoDoIt.js");
    return;
  }

  if (purchased.length > 0) {
    reportInfo(ns, "augs-batching", "Augmentierungen werden gesammelt", [
      `${purchased.length}/${CONFIG.minimumAugsBeforeInstall} für den nächsten Installations-Reset.`,
    ]);
  }
}

