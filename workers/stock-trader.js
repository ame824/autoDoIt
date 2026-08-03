import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportInfo } from "../core/notifier.js";
import { readNodeRushState, spendableMoney } from "../lib/node-rush.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).ramOnly || !ns.stock.hasTixApiAccess() || !ns.stock.has4SDataTixApi()) return;
  const symbols = ns.stock.getSymbols();
  const money = ns.getPlayer().money;
  const rush = readNodeRushState(ns);
  if (rush?.reserveMoney > 0 && money < rush.reserveMoney) {
    for (const symbol of symbols) {
      const [longShares, , shortShares] = ns.stock.getPosition(symbol);
      if (longShares > 0) ns.stock.sellStock(symbol, longShares);
      if (shortShares > 0) ns.stock.sellShort(symbol, shortShares);
    }
    reportInfo(ns, "stocks-liquidated-daedalus", "Aktien werden für Daedalus liquidiert", [
      `Geschützte Geldreserve: ${ns.format.number(rush.reserveMoney)}.`,
    ], 60_000);
    return;
  }
  const budget = (spendableMoney(money, rush) * CONFIG.stockBudgetFraction) /
    Math.max(1, symbols.length);
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
