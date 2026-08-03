import { reportInfo } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.gang.inGang()) return;
  const gang = ns.gang.getGangInformation();
  const others = ns.gang.getAllGangInformation();
  const rivals = Object.keys(others).filter((name) => name !== gang.faction && others[name]?.territory > 0);
  const safeForWarfare = rivals.length > 0 &&
    rivals.every((name) => ns.gang.getChanceToWinClash(name) >= 0.65);
  ns.gang.setTerritoryWarfare(safeForWarfare);
  reportInfo(ns, "gang-territory", "Gang-Territorium wird verwaltet", [
    `Territorialkrieg: ${safeForWarfare ? "aktiv" : "inaktiv"}`,
  ]);
}
