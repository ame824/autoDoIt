import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { scanNetwork } from "../core/network.js";
import { chooseNextBitNode } from "../lib/logic.js";
import {
  createNodeRushState,
  extractCriticalRequirements,
  writeNodeRushState,
} from "../lib/node-rush.js";
import { PORT_PROGRAMS } from "../lib/port-programs.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const WORLD_DAEMON = "w0r1d_d43m0n";
const BN15_LAB_REWARDS = Object.freeze([
  "The Broken Wings",
  "The Boots",
  "The Hammer",
  "The Staff",
  "The Red Pill",
]);
const BN15_LAB_CHARISMA = Object.freeze([300, 600, 1_500, 2_500, 3_000]);
const OPENERS = [
  [PORT_PROGRAMS[0].file, (ns, host) => ns.brutessh(host)],
  [PORT_PROGRAMS[1].file, (ns, host) => ns.ftpcrack(host)],
  [PORT_PROGRAMS[2].file, (ns, host) => ns.relaysmtp(host)],
  [PORT_PROGRAMS[3].file, (ns, host) => ns.httpworm(host)],
  [PORT_PROGRAMS[4].file, (ns, host) => ns.sqlinject(host)],
];
const DAEDALUS_FALLBACK_REQUIREMENTS = Object.freeze({
  money: 100_000_000_000,
  hacking: 2_500,
  augmentations: 30,
});

function daedalusRequirements(ns) {
  try {
    const extracted = extractCriticalRequirements(
      ns.singularity.getFactionInviteRequirements("Daedalus"),
    );
    return {
      money: extracted.money || DAEDALUS_FALLBACK_REQUIREMENTS.money,
      hacking: extracted.hacking || DAEDALUS_FALLBACK_REQUIREMENTS.hacking,
      augmentations: extracted.augmentations || DAEDALUS_FALLBACK_REQUIREMENTS.augmentations,
    };
  } catch {
    return { ...DAEDALUS_FALLBACK_REQUIREMENTS };
  }
}

export function worldDaemonPlan({ hasRedPill, reachable, rooted, hackingLevel, requiredLevel }) {
  if (!hasRedPill) return "labyrinth";
  if (!reachable) return "search";
  if (!rooted) return "root";
  if (Number(hackingLevel) < Number(requiredLevel)) return "train";
  return "destroy";
}

function tryRootWorldDaemon(ns) {
  for (const [file, open] of OPENERS) {
    if (!ns.fileExists(file, "home")) continue;
    try {
      open(ns, WORLD_DAEMON);
    } catch {
      // Port may already be open.
    }
  }
  try {
    ns.nuke(WORLD_DAEMON);
  } catch {
    return false;
  }
  return ns.hasRootAccess(WORLD_DAEMON);
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-progression", "BitNode-Abschluss ist noch nicht automatisierbar", [
      "Der Wechsel zum nächsten BitNode benötigt Source-File 4 oder BitNode 4.",
    ], [
      "The Red Pill installieren.",
      "w0r1d_d43m0n finden, Root-Zugriff erhalten und manuell abschließen.",
      "Nach BN1 im BitVerse BN4 wählen; autoDoIt wiederholt BN4 danach automatisch bis Source-File 4.3.",
    ]);
    return;
  }

  const installedNames = ns.singularity.getOwnedAugmentations(false);
  const installed = new Set(installedNames);
  const currentNode = Number(capabilities.reset.currentNode);
  const player = ns.getPlayer();
  const allOwned = ns.singularity.getOwnedAugmentations(true);
  const queuedLabReward = currentNode === 15
    ? allOwned.find((name) => !installed.has(name) && BN15_LAB_REWARDS.includes(name))
    : null;
  if (queuedLabReward) {
    reportSuccess(ns, `bn15-lab-reward-${queuedLabReward}`, `BN15-Labyrinthbelohnung wird installiert: ${queuedLabReward}`, [
      queuedLabReward === "The Red Pill"
        ? "Nach dem Reset beginnt sofort die Suche nach w0r1d_d43m0n."
        : "Nach dem Reset wird ohne Wartezeit die nächste Labyrinth-Stufe gesucht.",
    ]);
    ns.singularity.installAugmentations("/autoDoIt.js");
    return;
  }

  const hasRedPill = installed.has("The Red Pill");
  if (!hasRedPill) {
    const requirements = currentNode === 15
      ? { money: 0, hacking: 0, augmentations: 0 }
      : daedalusRequirements(ns);
    const rush = writeNodeRushState(ns, createNodeRushState({
      currentNode,
      playerMoney: player.money,
      hackingLevel: player.skills.hacking,
      installedAugmentations: installedNames.length,
      joinedDaedalus: player.factions.includes("Daedalus"),
      hasRedPill,
      daedalusRequirements: requirements,
      xpSprintRatio: CONFIG.nodeRushXpSprintRatio,
    }));
    if (currentNode === 15) {
      const completed = BN15_LAB_REWARDS.slice(0, -1)
        .filter((name) => installed.has(name)).length;
      const targetIndex = Math.min(completed, BN15_LAB_CHARISMA.length - 1);
      const targetName = BN15_LAB_REWARDS[targetIndex];
      const requiredCharisma = BN15_LAB_CHARISMA[targetIndex];
      const currentCharisma = Number(ns.getPlayer().skills.charisma);
      reportInfo(ns, "bn15-red-pill-route", "BN15 jagt The Red Pill im Darknet", [
        `Labyrinth-Vorstufen: ${completed}/4; aktuelles Ziel: ${targetName}.`,
        `Charisma: ${ns.format.number(currentCharisma)} / ${ns.format.number(requiredCharisma)} für diese Stufe.`,
        "Crawler prüfen bewegliche Darknet-Nachbarn alle 2 Sekunden und säen nach 15 Sekunden erneut.",
      ], 30_000);
    } else if (rush.stage === "daedalus-money") {
      reportInfo(ns, "daedalus-money-reserve", "Daedalus-Geldreserve aktiv", [
        `Geschützt: ${ns.format.number(rush.reserveMoney)} für die Einladung.`,
        "Optionale Infrastruktur-, Ausrüstungs- und Aktienkäufe verwenden nur den Überschuss.",
      ], 10_000);
    } else if (rush.stage === "daedalus-hacking") {
      reportInfo(ns, "daedalus-hacking", "Daedalus wartet nur noch auf Hacking", [
        `Hacking: ${ns.format.number(player.skills.hacking)} / ${ns.format.number(rush.targetHacking)}.`,
        rush.xpOnly ? "Hacking-EP-Endspurt aktiv." : "Geldproduktion läuft bis zum EP-Endspurt weiter.",
      ], 10_000);
    } else if (rush.stage === "daedalus-invite") {
      reportInfo(ns, "daedalus-invite-ready", "Daedalus-Einladung ist das nächste Ziel", [
        "Geld, Augmentierungen und Hacking erfüllen den erkannten API-Pfad.",
        "Das Fraktionsmodul nimmt die Einladung beim nächsten Zyklus an.",
      ], 10_000);
    }
    return;
  }

  const { hosts } = scanNetwork(ns);
  const reachable = hosts.includes(WORLD_DAEMON);
  const rooted = reachable && ns.hasRootAccess(WORLD_DAEMON);
  const hackingLevel = ns.getHackingLevel();
  const requiredLevel = reachable ? ns.getServerRequiredHackingLevel(WORLD_DAEMON) : Infinity;
  const rush = writeNodeRushState(ns, createNodeRushState({
    currentNode,
    playerMoney: player.money,
    hackingLevel,
    installedAugmentations: installedNames.length,
    joinedDaedalus: player.factions.includes("Daedalus"),
    hasRedPill,
    worldDaemonRequiredLevel: requiredLevel,
    xpSprintRatio: CONFIG.nodeRushXpSprintRatio,
  }));
  let plan = worldDaemonPlan({ hasRedPill, reachable, rooted, hackingLevel, requiredLevel });

  if (plan === "search") {
    reportInfo(ns, "daemon-search", "w0r1d_d43m0n wird aktiv gesucht", [
      "Das normale Netzwerk wird alle 2 Sekunden vollständig ab home gescannt.",
      "Nach installiertem The Red Pill muss der Daemon hinter The-Cave erscheinen.",
    ], 10_000);
    return;
  }

  if (plan === "root") {
    if (!tryRootWorldDaemon(ns)) {
      const available = OPENERS.filter(([file]) => ns.fileExists(file, "home")).length;
      reportInfo(ns, "daemon-root", "w0r1d_d43m0n wird direkt übernommen", [
        `Port-Programme: ${available}/5.`,
        "Der Abschlussmanager versucht Root bei jedem 2-Sekunden-Scan erneut.",
      ], 10_000);
      return;
    }
    reportSuccess(ns, "daemon-rooted", "w0r1d_d43m0n besitzt Root-Zugriff", [
      "Der BitNode-Abschluss wird ohne weiteren Netzwerkzyklus geprüft.",
    ]);
    plan = worldDaemonPlan({
      hasRedPill,
      reachable,
      rooted: true,
      hackingLevel,
      requiredLevel,
    });
  }

  if (plan === "train") {
    reportInfo(ns, "daemon-hacking", "w0r1d_d43m0n wartet nur noch auf Hacking", [
      `Hacking: ${ns.format.number(hackingLevel)} / ${ns.format.number(requiredLevel)} benötigt.`,
      rush.xpOnly
        ? "Hacking-EP-Endspurt aktiv: alle freien Worker schwächen das schnellste Ziel."
        : "Geldproduktion bleibt bis 75 % des benötigten Levels aktiv.",
    ], 10_000);
    return;
  }

  const nextNode = chooseNextBitNode(capabilities.reset, CONFIG.bitNodeMilestones);
  const nextLevel = Number(capabilities.sourceFileLevel(nextNode)) + 1;
  const routeReason = nextNode === 4 && nextLevel <= 3
    ? `Automatisierungsziel: Source-File 4.${nextLevel} reduziert die Singularity-RAM-Kosten.`
    : capabilities.sourceFileLevel(nextNode) === 0
      ? `Entdeckungsziel: Source-File ${nextNode}.1 fehlt noch.`
      : `Ausbauziel: Source-File ${nextNode}.${nextLevel}.`;
  reportInfo(ns, `next-bitnode-${nextNode}`, `Wechsel zu BitNode ${nextNode}`, [
    routeReason,
    "Fortschritt ist ausreichend; autoDoIt wird nach dem Wechsel neu gestartet.",
  ], 10_000);
  ns.singularity.destroyW0r1dD43m0n(nextNode, "/autoDoIt.js");
}
