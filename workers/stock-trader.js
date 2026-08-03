import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportInfo } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).ramOnly || !ns.stock.hasTixApiAccess() || !ns.stock.has4SDataTixApi()) return;
  const symbols = ns.stock.getSymbols();
  const budget = (ns.getPlayer().money * CONFIG.stockBudgetFraction) / Math.max(1, symbols.length);
  for (const symbol of symbols) {
    const [shares] = ns.stock.getPosition(symbol);
    const forecast = ns.stock.getForecast(symbol);
    if (shares > 0 && forecast < 0.52) {
      ns.stock.sellStock(symbol, shares);
      continue;
    }
    if (forecast < 0.60 || shares > 0) continue;
    const ask = ns.stock.getAskPrice(symbol);
    const amount = Math.min(ns.stock.getMaxShares(symbol), Math.floor(budget / ask));
    if (amount > 0) ns.stock.buyStock(symbol, amount);
  }
  reportInfo(ns, "stocks-active", "4S-Aktienhandel aktiv", [`${symbols.length} Symbole geprüft.`], 60_000);
}
