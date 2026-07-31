import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const CHURCH = "Church of the Machine God";

/** @param {NS} ns */
export async function main(ns) {
  if (Number(ns.getResetInfo()?.currentNode) !== 13) return;

  if (!ns.stanek || typeof ns.stanek.acceptGift !== "function") {
    reportBlocker(ns, "stanek-api", "Staneks Geschenk kann noch nicht automatisch angenommen werden", [
      "Die Stanek-API ist in diesem Spielstand nicht verfügbar.",
    ], [
      "In Chongqing mit Allison Stanek sprechen und das Geschenk annehmen.",
    ]);
    return;
  }

  if ((ns.getPlayer().factions ?? []).includes(CHURCH)) {
    reportInfo(ns, "stanek-active", "Staneks Geschenk ist aktiv", [
      "BN13 kann ohne manuelle Unterbrechung fortgesetzt werden.",
    ]);
    return;
  }

  if (ns.stanek.acceptGift()) {
    reportSuccess(ns, "stanek-accepted", "Staneks Geschenk automatisch angenommen", [
      `Fraktion: ${CHURCH}`,
      "Fraktions-, Augmentierungs- und BitNode-Fortschritt werden fortgesetzt.",
    ]);
    return;
  }

  reportBlocker(ns, "stanek-accept", "Staneks Geschenk wartet auf seine Voraussetzungen", [
    "autoDoIt versucht die Annahme bei jedem Zyklus erneut.",
  ], [
    "Noch keine normalen Augmentierungen kaufen; Staneks Geschenk muss zuerst angenommen werden.",
  ]);
}
