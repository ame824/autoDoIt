import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { readNodeRushState } from "../lib/node-rush.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readNodeRushState(ns)?.reserveMoney > 0) {
    reportInfo(ns, "stock-access-daedalus", "Aktienzugang wartet auf Daedalus", [
      "Die kritische Geldreserve wird nicht für TIX- oder 4S-Zugang ausgegeben.",
    ]);
    return;
  }
  const stock = ns.stock;
  if (!stock.hasTixApiAccess()) {
    if (stock.purchaseTixApi()) reportSuccess(ns, "stock-tix", "TIX-API gekauft");
    else reportBlocker(ns, "stock-tix-money", "TIX-API ist noch nicht verfügbar", [
      "Für automatische Aktiengeschäfte wird TIX-API-Zugriff benötigt.",
    ], ["Weiter Geld verdienen; autoDoIt versucht den Kauf später erneut."]);
    return;
  }
  if (!stock.has4SDataTixApi()) {
    if (stock.purchase4SMarketDataTixApi()) reportSuccess(ns, "stock-4s", "4S Market Data TIX API gekauft");
    else reportInfo(ns, "stock-4s-saving", "Aktienhandel wartet auf 4S-Daten", [
      "Ohne verlässliche Prognose führt autoDoIt keine spekulativen Käufe aus.",
    ]);
  }
}
