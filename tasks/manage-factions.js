import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { chooseFactionWorkType } from "../lib/logic.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

export function orderFactionInvitations(invitations) {
  const preferred = new Map(CONFIG.preferredCityFactions.map((name, index) => [name, index]));
  return [...invitations].sort((a, b) => {
    const aRank = preferred.has(a) ? preferred.get(a) : Number.MAX_SAFE_INTEGER;
    const bRank = preferred.has(b) ? preferred.get(b) : Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

function findRepTarget(ns, factions, owned) {
  const candidates = [];
  for (const faction of factions) {
    let factionRep;
    let augmentations;
    try {
      factionRep = ns.singularity.getFactionRep(faction);
      augmentations = ns.singularity.getAugmentationsFromFaction(faction);
    } catch {
      continue;
    }

    const missing = augmentations
      .filter((name) => name !== "NeuroFlux Governor" && !owned.has(name))
      .map((name) => ({ name, requirement: ns.singularity.getAugmentationRepReq(name) }))
      .filter(({ requirement }) => requirement > factionRep)
      .sort((a, b) => a.requirement - b.requirement);

    if (missing.length > 0) {
      candidates.push({
        faction,
        augmentation: missing[0].name,
        gap: missing[0].requirement - factionRep,
        requirement: missing[0].requirement,
      });
    }
  }
  return candidates.sort((a, b) => a.gap - b.gap)[0] ?? null;
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-factions", "Fraktionen benötigen noch manuelle Bedienung", [
      "Einladungen, Fraktionsarbeit und Anforderungen benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Fraktionseinladungen manuell prüfen und sinnvolle Fraktionen beitreten.",
      "Für benötigte Augmentierungen manuell Fraktionsreputation sammeln.",
    ]);
    return;
  }

  const player = ns.getPlayer();
  const joined = [...(player.factions ?? [])];
  const invitations = ns.singularity.checkFactionInvitations();

  for (const faction of orderFactionInvitations(invitations)) {
    if (ns.singularity.joinFaction(faction)) {
      joined.push(faction);
      reportSuccess(ns, `faction-join-${faction}`, `Fraktion beigetreten: ${faction}`);
    }
  }

  if (
    capabilities.gang &&
    !ns.gang.inGang() &&
    Number(player.karma) > -54_000
  ) {
    reportInfo(ns, "faction-yield-to-gang", "Fraktionsarbeit pausiert für Gang-Freischaltung", [
      "Das Gang-Modul baut zuerst das benötigte negative Karma auf.",
    ]);
    return;
  }

  const owned = new Set(ns.singularity.getOwnedAugmentations(true));
  const target = findRepTarget(ns, joined, owned);
  if (!target) return;

  const workTypes = ns.singularity.getFactionWorkTypes(target.faction);
  const workType = chooseFactionWorkType(workTypes);
  if (!workType) {
    reportInfo(ns, `faction-no-work-${target.faction}`, `${target.faction} bietet keine Arbeit an`, [
      `Benötigt für ${target.augmentation}: ${ns.format.number(target.requirement)} Reputation.`,
    ]);
    return;
  }

  const currentWork = ns.singularity.getCurrentWork();
  if (currentWork?.type === "FACTION" && currentWork?.factionName === target.faction) return;

  if (ns.singularity.workForFaction(target.faction, workType, false)) {
    reportInfo(ns, `faction-work-${target.faction}`, `Fraktionsarbeit gestartet: ${target.faction}`, [
      `Ziel: ${target.augmentation}`,
      `Arbeitsart: ${workType}`,
    ]);
  }
}
