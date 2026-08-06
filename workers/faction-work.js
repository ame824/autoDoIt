import { chooseFactionWorkType } from "../lib/logic.js";
import { FACTION_PLAN_FILE, parseFactionPlan } from "../lib/faction-plan.js";
import { readNodeRushState } from "../lib/node-rush.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const HACKING_GOAL_STAGES = new Set(["daedalus-hacking", "world-daemon-hacking"]);

export function isHackingGoalStage(state) {
  return HACKING_GOAL_STAGES.has(String(state?.stage ?? ""));
}

function universityForCity(ns, city) {
  const cities = ns.enums.CityName;
  const locations = ns.enums.LocationName;
  if (city === cities.Aevum) return locations.AevumSummitUniversity;
  if (city === cities.Sector12) return locations.Sector12RothmanUniversity;
  if (city === cities.Volhaven) return locations.VolhavenZBInstituteOfTechnology;
  return null;
}

function trainHackingForGoal(ns, state) {
  const course = ns.enums.UniversityClassType.algorithms;
  const current = ns.singularity.getCurrentWork();
  if (current?.type === "CLASS" && current.classType === course) return true;

  let city = ns.getPlayer().city;
  let university = universityForCity(ns, city);
  if (!university) {
    city = ns.enums.CityName.Volhaven;
    if (!ns.singularity.travelToCity(city)) {
      reportBlocker(ns, "goal-hacking-travel", "Hacking-Training für BitNode-Ziel wartet", [
        "Für den Algorithms-Kurs muss autoDoIt eine Universitätsstadt erreichen.",
      ], ["Mindestens 200.000 Dollar für die Reise nach Volhaven bereithalten."]);
      return false;
    }
    university = ns.enums.LocationName.VolhavenZBInstituteOfTechnology;
  }

  if (!ns.singularity.universityCourse(university, course, false)) {
    reportBlocker(ns, "goal-hacking-course", "Hacking-Training für BitNode-Ziel wartet", [
      `${university}: ${course} konnte nicht gestartet werden.`,
    ], ["Universitätsseite einmal manuell öffnen und autoDoIt weiterlaufen lassen."]);
    return false;
  }
  reportInfo(ns, `goal-hacking-${state.stage}`, "Hacking-Training für BitNode-Ziel gestartet", [
    `Phase: ${state.stage}`,
    `${university}: ${course}`,
    `Ziel-Level: ${ns.format.number(state.targetHacking)}.`,
    "Normale Fraktions-, Job- und Charisma-Arbeit bleibt bis zum Ziel pausiert.",
  ], 30_000);
  return true;
}

/** @param {NS} ns */
export async function main(ns) {
  const nodeRush = readNodeRushState(ns);
  if (isHackingGoalStage(nodeRush)) {
    trainHackingForGoal(ns, nodeRush);
    return;
  }

  const target = parseFactionPlan(ns.read(FACTION_PLAN_FILE))?.workTarget;
  if (!target) return;
  const workType = chooseFactionWorkType(ns.singularity.getFactionWorkTypes(target.faction));
  if (!workType) {
    reportInfo(ns, `faction-no-work-${target.faction}`, `${target.faction} bietet keine Arbeit an`, [
      `Benötigt für ${target.augmentation}: ${ns.format.number(target.requirement)} Reputation.`,
    ]);
    return;
  }
  const current = ns.singularity.getCurrentWork();
  if (current?.type === "FACTION" && current?.factionName === target.faction) return;
  if (ns.singularity.workForFaction(target.faction, workType, false)) {
    reportInfo(ns, `faction-work-${target.faction}`, `Fraktionsarbeit gestartet: ${target.faction}`, [
      `Ziel: ${target.augmentation}`,
      `Preis: ${ns.format.number(target.price)}`,
      `Arbeitsart: ${workType}`,
    ]);
  }
}
