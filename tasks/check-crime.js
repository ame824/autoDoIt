import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker } from "../core/notifier.js";
import {
  analyzeFallbackCrimes,
  chooseCrime,
  determineCrimeGoal,
} from "../lib/crime-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (capabilities.singularity) return;

  const player = ns.getPlayer();
  const currentNode = Number(capabilities.reset.currentNode);
  const goal = determineCrimeGoal({
    currentNode,
    gangAvailable: currentNode === 2,
    inGang: false,
    karma: player.karma,
    money: player.money,
    skills: player.skills,
    bootstrapMoney: CONFIG.casinoMinimumMoney,
  });
  if (!goal) return;

  const best = chooseCrime(analyzeFallbackCrimes(player, currentNode), goal.type);
  if (!best) return;
  reportBlocker(ns, `crime-advice-${goal.reason}-${best.name}`, "Verbrechen können noch nicht automatisiert werden", [
    `Aktuelles Ziel: ${goal.type}`,
    `Beste manuelle Wahl: ${best.name}`,
    `Geschätzte Erfolgschance: ${ns.format.percent(best.chance)}`,
    `Erwartetes Geld: ${ns.format.number(best.moneyPerSecond)} / s`,
  ], [
    `Im Stadtmenü Slums öffnen und ${best.name} wiederholt ausführen.`,
    "Source-File 4 freischalten; danach übernimmt der Crime-Manager automatisch.",
  ]);
}
