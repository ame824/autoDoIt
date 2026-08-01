import { reportSuccess } from "../core/notifier.js";
import { shouldAcceptInvestment } from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation()) return;
  let corporation = corp.getCorporation();
  if (!corporation.public) {
    const offer = corp.getInvestmentOffer();
    if (shouldAcceptInvestment(offer, corporation) && corp.acceptInvestmentOffer()) {
      reportSuccess(ns, `corporation-investment-${offer.round}`, `Corporation-Investitionsrunde ${offer.round} angenommen`, [
        ns.format.number(offer.funds),
      ]);
      return;
    }
    if ((offer.round < 1 || offer.round > 4) && corporation.valuation >= 1e15) {
      const shares = Math.floor(corporation.numShares * 0.10);
      if (shares > 0 && corp.goPublic(shares)) {
        reportSuccess(ns, "corporation-public", "Corporation ist an die Börse gegangen");
      }
    }
    return;
  }
  corporation = corp.getCorporation();
  const profit = Math.max(0, corporation.revenue - corporation.expenses);
  const rate = profit > 0 && corporation.funds >= 1e15 ? 0.10 : 0;
  if (corporation.dividendRate !== rate) corp.issueDividends(rate);
}
