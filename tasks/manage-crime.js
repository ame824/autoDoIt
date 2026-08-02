import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import {
  CRIMES,
  CRIME_GOAL,
  analyzeCrime,
  chooseCrime,
  determineCrimeGoal,
} from "../lib/crime-logic.js";

const STATE_FILE = "/data/autoDoIt-crime-state.txt";

function readState(ns) {
  try {
    return JSON.parse(ns.read(STATE_FILE) || "{}");
  } catch {
    return {};
  }
}

function goalLabel(goal) {
  return {
    [CRIME_GOAL.money]: "Geld pro Sekunde",
    [CRIME_GOAL.karma]: "negatives Karma pro Sekunde",
    [CRIME_GOAL.kills]: "Kills pro Sekunde",
    [CRIME_GOAL.combat]: "Kampf-Erfahrung pro Sekunde",
    [CRIME_GOAL.balanced]: "ausgewogener Fortschritt",
  }[goal] ?? goal;
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-crime", "Crime-Manager ist gesperrt", [
      "Das automatische Starten von Verbrechen benötigt BitNode 4 oder Source-File 4.",
    ], [
      "Die Empfehlung des leichten Crime-Beraters manuell ausführen.",
    ]);
    return;
  }

  const player = ns.getPlayer();
  const currentNode = Number(capabilities.reset.currentNode);
  let inGang = false;
  if (capabilities.gang) {
    try {
      inGang = ns.gang.inGang();
    } catch {
      inGang = false;
    }
  }
  const currentWork = ns.singularity.getCurrentWork();
  const state = readState(ns);
  let goal = determineCrimeGoal({
    currentNode,
    gangAvailable: capabilities.gang,
    inGang,
    karma: player.karma,
    money: player.money,
    skills: player.skills,
    bootstrapMoney: CONFIG.casinoMinimumMoney,
  });

  if (!goal && currentWork?.type === "CRIME" && state.managed && state.crime === currentWork.crimeType) {
    ns.singularity.stopAction();
    ns.write(STATE_FILE, "{}", "w");
    reportSuccess(ns, "crime-goal-complete", "Crime-Ziel erreicht; normale Arbeit wird fortgesetzt");
    return;
  }
  if (!goal && currentWork?.type === "CRIME") {
    goal = { type: CRIME_GOAL.balanced, urgent: false, reason: "manual-crime" };
  }
  if (!goal) return;
  if (currentWork && currentWork.type !== "CRIME" && !goal.urgent) return;

  const analyses = [];
  for (const { name } of CRIMES) {
    try {
      const stats = ns.singularity.getCrimeStats(name);
      const chance = ns.singularity.getCrimeChance(name);
      analyses.push(analyzeCrime(name, stats, chance, player, 100));
    } catch {
      // A renamed or unavailable crime must not disable the remaining choices.
    }
  }
  const best = chooseCrime(analyses, goal.type);
  if (!best) return;

  if (currentWork?.type === "CRIME" && currentWork.crimeType === best.name) {
    reportInfo(ns, `crime-running-${goal.type}-${best.name}`, `Crime-Manager optimiert auf ${goalLabel(goal.type)}`, [
      `Aktion: ${best.name}`,
      `Erfolgschance: ${ns.format.percent(best.chance)}`,
      `Erwartetes Geld: ${ns.format.number(best.moneyPerSecond)} / s`,
      `Erwartetes Karma: -${ns.format.number(best.karmaPerSecond)} / s`,
    ]);
    return;
  }

  const duration = ns.singularity.commitCrime(best.name, false);
  if (duration <= 0) return;
  ns.write(STATE_FILE, JSON.stringify({
    managed: true,
    crime: best.name,
    goal: goal.type,
    reason: goal.reason,
    currentNode,
    startedAt: Date.now(),
  }), "w");
  reportSuccess(ns, `crime-start-${goal.type}-${best.name}`, `Optimales Verbrechen gestartet: ${best.name}`, [
    `Ziel: ${goalLabel(goal.type)}`,
    `Erfolgschance: ${ns.format.percent(best.chance)}`,
    `Erwartetes Geld: ${ns.format.number(best.moneyPerSecond)} / s`,
    `Dauer je Versuch: ${ns.format.time(duration)}`,
  ]);
}
