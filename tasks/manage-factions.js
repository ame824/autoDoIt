import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { chooseFactionWorkType } from "../lib/logic.js";
import {
  chooseCheapestFactionAugmentation,
  chooseNeuroFluxFaction,
  collectFactionAugmentationOptions,
} from "../lib/faction-augmentations.js";
import {
  createGangReputationGoal,
  GANG_REPUTATION_GOAL_FILE,
} from "../lib/gang-logic.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

export function orderFactionInvitations(invitations) {
  const preferred = new Map(CONFIG.preferredCityFactions.map((name, index) => [name, index]));
  return [...invitations].sort((a, b) => {
    const aRank = preferred.has(a) ? preferred.get(a) : Number.MAX_SAFE_INTEGER;
    const bRank = preferred.has(b) ? preferred.get(b) : Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

function textOf(element) {
  return String(element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function dismissFactionInvitation(ns) {
  try {
    const doc = eval("document");
    if (!/You received a faction invitation/i.test(textOf(doc.body))) return;
    const decideLater = [...doc.querySelectorAll("button")].find(
      (button) => /Decide later/i.test(textOf(button)),
    );
    if (!decideLater) return;
    const key = Object.keys(decideLater).find((name) => name.startsWith("__reactProps$"));
    const handler = key ? decideLater[key]?.onClick : null;
    if (typeof handler === "function") await handler({ isTrusted: true });
    else decideLater.click();
  } catch {
    // The invitation was already handled or the player is not on a browser UI.
  }
}

export function findRepTarget(ns, factions, owned) {
  const specific = collectFactionAugmentationOptions(ns, factions, owned);
  const target = chooseCheapestFactionAugmentation(
    specific.filter(({ gap }) => gap > 0),
  );
  if (target) return { ...target, augmentation: target.name, neuroFluxStage: false };
  if (specific.length > 0) return null;

  const neuroFlux = chooseNeuroFluxFaction(
    collectFactionAugmentationOptions(ns, factions, owned, true),
  );
  return neuroFlux
    ? { ...neuroFlux, augmentation: neuroFlux.name, neuroFluxStage: true }
    : null;
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
  await dismissFactionInvitation(ns);

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

  let gangFaction = "";
  if (capabilities.gang && ns.gang.inGang()) {
    gangFaction = String(ns.gang.getGangInformation().faction ?? "");
  }
  const owned = new Set(ns.singularity.getOwnedAugmentations(true));
  let target = findRepTarget(ns, joined, owned);
  if (target?.neuroFluxStage && target.faction === gangFaction) {
    const alternative = chooseNeuroFluxFaction(
      collectFactionAugmentationOptions(ns, joined, owned, true)
        .filter(({ faction }) => faction !== gangFaction),
    );
    target = alternative
      ? { ...alternative, augmentation: alternative.name, neuroFluxStage: true }
      : null;
  }
  const gangGoal = createGangReputationGoal(target, gangFaction);
  ns.write(GANG_REPUTATION_GOAL_FILE, gangGoal ? JSON.stringify(gangGoal) : "", "w");
  if (!target) return;

  if (gangGoal) {
    reportInfo(ns, `gang-reputation-${gangGoal.augmentation}`, "Gang sammelt Reputation für Augmentierung", [
      `Ziel: ${gangGoal.augmentation}`,
      `Reputation: ${ns.format.number(gangGoal.factionRep)} / ${ns.format.number(gangGoal.requirement)}`,
      "Der Gangmanager priorisiert dafür Respekt und hält Wanted kontrolliert.",
    ]);
    return;
  }

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
      `Preis: ${ns.format.number(target.price)}`,
      `Arbeitsart: ${workType}`,
    ]);
  }
}
