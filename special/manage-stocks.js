import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).active) return;
  const stock = ns.stock;
  if (!stock.hasTixApiAccess()) {
    if (stock.purchaseTixApi()) {
      reportSuccess(ns, "stock-tix", "TIX-API gekauft");
    } else {
      reportBlocker(ns, "stock-tix-money", "TIX-API ist noch nicht verfügbar", [
        "Für automatische Aktiengeschäfte wird TIX-API-Zugriff benötigt.",
      ], [
        "Weiter Geld verdienen; autoDoIt versucht den Kauf später erneut.",
      ]);
      return;
    }
  }

  if (!stock.has4SDataTixApi()) {
    if (stock.purchase4SMarketDataTixApi()) {
      reportSuccess(ns, "stock-4s", "4S Market Data TIX API gekauft");
    } else {
      reportInfo(ns, "stock-4s-saving", "Aktienhandel wartet auf 4S-Daten", [
        "Ohne verlässliche Prognose führt autoDoIt keine spekulativen Käufe aus.",
      ]);
      return;
    }
  }

  const symbols = stock.getSymbols();
  const money = ns.getPlayer().money;
  const budgetPerSymbol = (money * CONFIG.stockBudgetFraction) / Math.max(1, symbols.length);

  for (const symbol of symbols) {
    const [longShares, longAverage] = stock.getPosition(symbol);
    const forecast = stock.getForecast(symbol);
    const bid = stock.getBidPrice(symbol);

    if (longShares > 0 && forecast < 0.52) {
      stock.sellStock(symbol, longShares);
      continue;
    }
    if (forecast < 0.60 || longShares > 0) continue;

    const maxShares = stock.getMaxShares(symbol);
    const ask = stock.getAskPrice(symbol);
    const shares = Math.min(maxShares, Math.floor(budgetPerSymbol / ask));
    if (shares > 0) stock.buyStock(symbol, shares);

    if (longShares > 0 && bid > longAverage) {
      // Position remains open while the 4S forecast is positive.
    }
  }

  reportInfo(ns, "stocks-active", "4S-Aktienhandel aktiv", [
    `${symbols.length} Symbole geprüft.`,
  ], 60_000);
}
